'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText, Shield, ChevronRight, ChevronLeft, Loader2, Download, Upload, Layout, FileCheck, Receipt, Plus, Trash2, Calendar, DollarSign, Paperclip, X, Image as ImageIcon, Check, Pencil, User, ChevronDown, MessageSquare, Send, Reply, Forward, AlertTriangle, Clipboard, MapPin, HardHat, Eye, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal, MyDropDown, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, FileDropZone } from '@/components/ui';
import type { UploadedFile } from '@/components/ui';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, DATA_SCOPE, ACTIONS } from '@/lib/permissions/types';
import { JHAModal } from '@/app/(protected)/jobs/schedules/components/JHAModal';
import { DJTModal } from '@/app/(protected)/jobs/schedules/components/DJTModal';
import { EmailModal } from '@/app/(protected)/jobs/schedules/components/EmailModal';
import { getDJTPdfVariablesBase } from '@/lib/djtHelper';
import { getLocalNowISO } from '@/lib/scheduleUtils';
import { useRouter } from 'next/navigation';
import { JHACard } from '@/app/(protected)/docs/jha/components/JHACard';
import { DJTCard } from '@/app/(protected)/docs/job-tickets/components/DJTCard';
import { PotholeLogCard } from '@/app/(protected)/docs/pothole-logs/components/PotholeLogCard';
import { PreBoreLogCard } from '@/app/(protected)/docs/pre-bore-logs/components/PreBoreLogCard';
import { PotholeLogFormModal } from '@/components/pothole-logs/PotholeLogFormModal';
import { SignedContractsCard } from './SignedContractsCard';
import { PlanningCard } from './PlanningCard';
import { ReceiptsCard } from './ReceiptsCard';
import useSWR from 'swr';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

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

/**
 * Parse a date string into a local Date, preventing timezone shifts.
 * Date-only strings like "2026-03-04" are treated as local midnight
 * instead of UTC midnight (which causes off-by-one day issues).
 */
const toLocalDate = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr || String(dateStr).trim() === '') return null;
    let finalStr = String(dateStr).trim();
    // If it's a date-only string (YYYY-MM-DD), append local time to avoid UTC interpretation
    if (/^\d{4}-\d{2}-\d{2}$/.test(finalStr)) {
        finalStr = `${finalStr}T00:00:00`;
    }
    // If it has a 'T' but no timezone offset/Z suffix, it's already local — leave it
    // If it has 'Z' or an offset like +05:00, parse it but we still want local display
    const d = new Date(finalStr);
    if (isNaN(d.getTime())) return null;
    return d;
};

/**
 * Format a date string as local date for display in documents.
 * Uses toLocalDate to prevent timezone day-shifts.
 */
const localeDateString = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '';
    const d = toLocalDate(dateStr);
    if (!d) return String(dateStr);
    return d.toLocaleDateString('en-US');
};

const safeFormatDate = (dateStr: string | undefined | null, formatStr: string = 'MM/dd/yy') => {
    if (!dateStr || String(dateStr).trim() === '') return '-';
    try {
        const d = toLocalDate(dateStr);
        if (!d) {
            return String(dateStr) || '-';
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
    chartData?: { slices: any[]; subTotal: number; grandTotal: number; markupPct: number };
    onOpenVendorsModal?: () => void;
}

export const EstimateDocsCard: React.FC<EstimateDocsCardProps> = ({ className, formData, employees = [], onUpdate, planningOptions = [], activeClient, chartData, onOpenVendorsModal }) => {
    const { user: currentUser, getDataScope, can } = usePermissions();
    const router = useRouter();
    const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
    const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
    const [generatingProgress, setGeneratingProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Aggregated Receipts & Billing Tickets State
    const [aggregatedReceipts, setAggregatedReceipts] = useState<any[]>([]);
    const [aggregatedBillingTickets, setAggregatedBillingTickets] = useState<any[]>([]); // New State
    const [isBillingAggregated, setIsBillingAggregated] = useState(false);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [billingTicketAssignees, setBillingTicketAssignees] = useState<string[]>(['dt@devco-inc.com', 'rosa@devco-inc.com']);

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
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const [djtEmailModalOpen, setDjtEmailModalOpen] = useState(false);
    const [djtEmailTo, setDjtEmailTo] = useState('');
    const [isSendingDjtEmail, setIsSendingDjtEmail] = useState(false);

    // DJT Modal State
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Pothole Log Modal State
    const [potholeModalOpen, setPotholeModalOpen] = useState(false);
    const [selectedPotholeLog, setSelectedPotholeLog] = useState<any>(null);
    const [potholeLogToDelete, setPotholeLogToDelete] = useState<any>(null);
    const [potholeCreateOpen, setPotholeCreateOpen] = useState(false);
    const [potholeEditOpen, setPotholeEditOpen] = useState(false);
    const [editingPotholeLog, setEditingPotholeLog] = useState<any>(null);
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

    // Vendor & Subs State
    const VENDOR_SUBS_TYPES = [
        'COI', 'W9', 'Prelim',
        'Conditional Release on Progress Payment',
        'Conditional Release on Final Payment',
        'Unconditional Release on Progress Payment',
        'Unconditional Release on Final Payment',
        'CPR', 'Other'
    ];
    const [vendorSubsDocs, setVendorSubsDocs] = useState<any[]>([]);
    const [loadingVendorSubs, setLoadingVendorSubs] = useState(false);
    const [isVendorSubsModalOpen, setIsVendorSubsModalOpen] = useState(false);
    const [selectedVendorSubsDoc, setSelectedVendorSubsDoc] = useState<any>(null);
    const [isVendorSubsUploading, setIsVendorSubsUploading] = useState(false);
    const [vendorSubsToDelete, setVendorSubsToDelete] = useState<string | null>(null);
    const [isVendorSubsTypeOpen, setIsVendorSubsTypeOpen] = useState(false);
    const [isVendorSubsNameOpen, setIsVendorSubsNameOpen] = useState(false);
    const [newVendorSubs, setNewVendorSubs] = useState({
        type: '',
        vendorSubName: '',
        fileName: '',
        files: [] as any[]
    });

    // 20 Day Prelim State
    const [prelimDocRecords, setPrelimDocRecords] = useState<any[]>([]);
    const [loadingPrelimDocs, setLoadingPrelimDocs] = useState(false);
    const [isGeneratingPrelim, setIsGeneratingPrelim] = useState(false);
    const [isPrelimUploading, setIsPrelimUploading] = useState(false);
    const [prelimUploadingDocId, setPrelimUploadingDocId] = useState<string | null>(null);
    const [prelimDocToDelete, setPrelimDocToDelete] = useState<string | null>(null);
    const [isPrelimAccordionOpen, setIsPrelimAccordionOpen] = useState(true);
    const prelimUploadRef = React.useRef<HTMLInputElement>(null);

    // Fetch billing ticket assignees setting
    useEffect(() => {
        fetch('/api/app-settings?key=billingTicketAssignees')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.result?.data && Array.isArray(data.result.data)) {
                    setBillingTicketAssignees(data.result.data);
                }
            })
            .catch(console.error);
    }, []);

    const { data: aggregatedData, isLoading: aggregatedLoading } = useSWR(
        formData?.estimate ? ['/api/estimates/aggregated', formData.estimate] : null,
        async ([_, estimateNumber]) => {
            const res = await fetch(`/api/estimates?limit=1000&includeReceipts=true&includeBilling=true`);
            const data = await res.json();
            if (data.success && Array.isArray(data.result)) {
                return data.result.filter((e: any) => String(e.estimate || '').trim() === String(estimateNumber || '').trim());
            }
            return [];
        },
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    useEffect(() => {
        setLoadingReceipts(aggregatedLoading);
        if (!aggregatedData) return;
        const relevantEstimates = aggregatedData;

        // --- Aggregating Receipts ---
        let allR: any[] = [];
        const addedIds = new Set<string>();
        const addedKeys = new Set<string>();

        const addUnique = (list: any[]) => {
            list.forEach(r => {
                if (!r) return;
                if (r._id) {
                    if (!addedIds.has(r._id)) {
                        addedIds.add(r._id);
                        allR.push(r);
                    }
                } else {
                    const key = `${r.vendor}|${r.amount}|${r.date}|${r.remarks}`;
                    if (!addedKeys.has(key)) {
                        addedKeys.add(key);
                        allR.push(r);
                    }
                }
            });
        };

        if (formData?.receiptsAndCosts) addUnique(formData.receiptsAndCosts);
        relevantEstimates.forEach((est: any) => {
            if (est.receiptsAndCosts && Array.isArray(est.receiptsAndCosts)) addUnique(est.receiptsAndCosts);
        });

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

        if (formData?.billingTickets) addUniqueBilling(formData.billingTickets);
        relevantEstimates.forEach((est: any) => {
            if (est.billingTickets && Array.isArray(est.billingTickets)) addUniqueBilling(est.billingTickets);
        });

        const bScope = getDataScope(MODULES.BILLING_TICKETS);
        if (bScope === DATA_SCOPE.SELF && !currentUser?.role?.includes('Admin')) {
            const userEmail = currentUser?.email?.toLowerCase();
            const userId = currentUser?.userId;
            allB = allB.filter(b => {
                const isCreator = String(b.createdBy || '').toLowerCase() === userEmail;
                const isTagged = (b.tag || []).some((t: string) => {
                    const tl = String(t || '').toLowerCase();
                    return tl === userEmail || t === userId;
                });
                return isCreator || isTagged;
            });
        }
        allB.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setAggregatedBillingTickets(allB);
        setIsBillingAggregated(true);
    }, [aggregatedData, formData?.receiptsAndCosts, formData?.billingTickets, currentUser, getDataScope]);

    const { data: jobDocsData, isLoading: jobDocsIsLoading, mutate: refetchJobDocs } = useSWR(
        formData?.estimate ? ['/api/job-docs', formData.estimate] : null,
        async ([_, estimate]) => {
            const [schedRes, initRes, jhaRes, djtRes, phRes, vsRes] = await Promise.all([
                fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getSchedulesByEstimate', payload: { estimateNumber: estimate } }) }),
                fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getInitialData', payload: {} }) }),
                fetch('/api/jha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getJHAs', payload: { page: 1, limit: 500, estimate: estimate } }) }),
                fetch('/api/djt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getDJTs', payload: { page: 1, limit: 500, estimate: estimate } }) }),
                fetch('/api/pothole-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getPotholeLogs', payload: { estimate: estimate } }) }),
                fetch('/api/vendor-subs-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getVendorSubsDocs', payload: { estimate: estimate } }) })
            ]);

            const [schedData, initData, jhaData, djtData, phData, vsData] = await Promise.all([
                schedRes.json(), initRes.json(), jhaRes.json(), djtRes.json(), phRes.json(), vsRes.json()
            ]);

            return { schedData, initData, jhaData, djtData, phData, vsData };
        },
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    useEffect(() => {
        setLoadingJobDocs(jobDocsIsLoading);
        if (!jobDocsData) return;

        const { schedData, initData, jhaData, djtData, phData, vsData } = jobDocsData;
        const filteredSchedules = schedData.success ? (schedData.result || []) : [];
        setEstimateSchedules(filteredSchedules);
        const scheduleIds = filteredSchedules.map((s: any) => String(s._id));

        if (initData.success && initData.result?.equipmentItems) {
            setEquipmentItems(initData.result.equipmentItems);
        }

        if (jhaData.success && jhaData.result?.jhas) {
            const filtered = jhaData.result.jhas.filter((j: any) => scheduleIds.includes(String(j.schedule_id || '')));
            setJhaRecords(filtered);
        }

        if (djtData.success && djtData.result?.djts) {
            const filtered = djtData.result.djts.filter((d: any) => scheduleIds.includes(String(d.schedule_id || '')));
            const uniqueDjts = Array.from(new Map(filtered.map((d: any) => [String(d.schedule_id), d])).values());
            setJobTicketRecords(uniqueDjts);
        }

        if (phData.success) {
            setPotholeLogRecords(phData.result || []);
        }

        const pbLogs: any[] = [];
        for (const sched of filteredSchedules) {
            if (sched.preBore && Array.isArray(sched.preBore) && sched.preBore.length > 0) {
                sched.preBore.forEach((pb: any) => pbLogs.push({ ...pb, scheduleId: sched._id, scheduleTitle: sched.title }));
            }
        }
        setPreBoreLogRecords(pbLogs);

        if (vsData.success) setVendorSubsDocs(vsData.result || []);
    }, [jobDocsData, jobDocsIsLoading]);

    // Normalized employees for modals
    const normalizedEmployees = useMemo(() => {
        return (employees || []).map((e: any) => ({
            ...e,
            label: e.label || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
            value: e.value || e.email || e._id,
            image: e.profilePicture || e.image
        }));
    }, [employees]);

    // --- 20 Day Prelim: Fetch Records ---
    const { data: prelimData, isLoading: prelimIsLoading, mutate: fetchPrelimDocs } = useSWR(
        formData?.estimate ? ['/api/prelim-docs', formData.estimate] : null,
        async ([_, estimate]) => {
            const res = await fetch('/api/prelim-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getPrelimDocs', payload: { estimate: estimate } })
            });
            const data = await res.json();
            return data.success ? (data.result || []) : [];
        },
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    useEffect(() => {
        setLoadingPrelimDocs(prelimIsLoading);
        if (prelimData) {
            setPrelimDocRecords(prelimData);
        }
    }, [prelimData, prelimIsLoading]);

    // --- 20 Day Prelim: Direct Generate (no modal) ---
    const handleDirectGeneratePrelim = async () => {
        if (!formData?.estimate || isGeneratingPrelim) return;
        await handleSubmitPrelimDoc();
    };

    // --- 20 Day Prelim: Upload file to an existing record ---
    const handlePrelimRecordUpload = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsPrelimUploading(true);
        setPrelimUploadingDocId(docId);
        const file = files[0];
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', `estimates/${formData?.estimate || 'general'}/prelims`);
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadData.success && uploadData.url) {
                const uploadedFile = {
                    url: uploadData.url,
                    r2Key: uploadData.r2Key || '',
                    thumbnailUrl: (uploadData.thumbnailUrl && !uploadData.thumbnailUrl.startsWith('data:')) ? uploadData.thumbnailUrl : '',
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    uploadedBy: currentUser?.email || '',
                    uploadedAt: new Date().toISOString(),
                };
                // Update the record with the uploaded file
                const res = await fetch('/api/prelim-docs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'uploadToPrelimDoc', payload: { id: docId, uploadedFile } }),
                });
                const data = await res.json();
                if (data.success) {
                    toast.success('File uploaded successfully');
                    fetchPrelimDocs();
                } else toast.error('Failed to save uploaded file');
            } else toast.error(`Failed to upload ${file.name}`);
        } catch (err) { console.error(err); toast.error(`Error uploading ${file.name}`); }
        setIsPrelimUploading(false);
        setPrelimUploadingDocId(null);
        if (prelimUploadRef.current) prelimUploadRef.current.value = '';
    };

    // --- 20 Day Prelim: Submit (Generate PDF directly, no modal) ---
    const handleSubmitPrelimDoc = async () => {
        if (!formData?.estimate) return;

        setIsGeneratingPrelim(true);
        try {
            const userEmail = currentUser?.email?.toLowerCase();
            const loggedInEmp = employees.find(
                (e: any) => (e.email || '').toLowerCase() === userEmail || (e._id || '').toLowerCase() === userEmail
            );
            const createdByName = loggedInEmp
                ? `${loggedInEmp.firstName || ''} ${loggedInEmp.lastName || ''}`.trim()
                : (currentUser as any)?.name || '';
            const position = loggedInEmp?.companyPosition || '';
            const signature = loggedInEmp?.signature || '';
            const todayDate = new Date().toLocaleDateString('en-US');

            const variables: Record<string, string> = {
                createdBy: createdByName, position, signature,
                date: todayDate, today: todayDate,
                estimate: formData.estimate || '',
                customerName: formData.customerName || '',
                jobAddress: formData.jobAddress || '',
                projectDescription: formData.projectDescription || '',
                prelimAmount: (() => {
                    const val = formData.prelimAmount;
                    if (!val) return '';
                    const n = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
                    return !isNaN(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : String(val);
                })(),
                poName: formData.poName || '', PoAddress: formData.PoAddress || '', PoPhone: formData.PoPhone || '',
                ocName: formData.ocName || '', ocAddress: formData.ocAddress || '', ocPhone: formData.ocPhone || '',
                subCName: formData.subCName || '', subCAddress: formData.subCAddress || '', subCPhone: formData.subCPhone || '',
                liName: formData.liName || '', liAddress: formData.liAddress || '', liPhone: formData.liPhone || '',
                scName: formData.scName || '', scAddress: formData.scAddress || '', scPhone: formData.scPhone || '',
                bondNumber: formData.bondNumber || '',
                contactName: formData.contactName || '', contactEmail: formData.contactEmail || '', contactPhone: formData.contactPhone || '',
                projectName: formData.projectName || '',
                customerPONo: formData.customerPONo || '', workRequestNo: formData.workRequestNo || '',
                subContractAgreementNo: formData.subContractAgreementNo || '',
                customerJobNo: formData.customerJobNo || '', DIRProjectNo: formData.DIRProjectNo || '',
                projectId: formData.projectId || '',
                grandTotal: (() => {
                    const liveGT = chartData?.grandTotal;
                    if (liveGT && liveGT > 0) return `$${liveGT.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                    const gt = formData.grandTotal;
                    if (gt) { const n = parseFloat(String(gt).replace(/[^0-9.-]+/g, '')); return !isNaN(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''; }
                    return '';
                })(),
            };

            const res = await fetch('/api/prelim-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generatePrelimDoc',
                    payload: {
                        estimate: formData.estimate, variables, docName: '20 Day Prelim',
                        createdByName, createdByEmail: currentUser?.email || '',
                        position, generatedDate: todayDate,
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('20 Day Prelim generated!');
                fetchPrelimDocs();
            } else {
                toast.error(data.error || 'Failed to generate');
            }
        } catch (err: any) {
            console.error('Prelim error:', err);
            toast.error(err.message || 'Error creating prelim');
        } finally { setIsGeneratingPrelim(false); }
    };

    const handleDeletePrelimDoc = async (id: string) => {
        try {
            await fetch('/api/prelim-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePrelimDoc', payload: { id } })
            });
            setPrelimDocRecords(prev => prev.filter(d => d._id !== id));
            setPrelimDocToDelete(null);
            toast.success('Document removed');
        } catch (err) { toast.error('Error deleting'); }
    };

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

    const handleDownloadJHAPDF = async (jhaOverride?: any, setCardDownloading?: (b: boolean) => void) => {
        const target = jhaOverride || selectedJHA;
        if (!target) return;
        
        if (setCardDownloading) setCardDownloading(true);
        else setIsGeneratingJHAPDF(true);
        
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            let schedule = estimateSchedules.find(s => s._id === target.schedule_id);
            if (!schedule && target.scheduleRef) {
                schedule = typeof target.scheduleRef === 'string' ? null : target.scheduleRef;
            }
            if (!schedule) {
                schedule = { customerName: formData?.customerName };
            }

            const variables: any = { 
                ...target, 
                customerId: schedule?.customerName || formData?.customerName || '',
                contactName: formData?.contactName || formData?.contact || '',
                contactPhone: formData?.contactPhone || formData?.phone || '',
                jobAddress: formData?.jobAddress || schedule?.jobLocation || '',
                estimateNum: schedule?.estimate || formData?.estimate || '',
                estimate: schedule?.estimate || formData?.estimate || '',
                customerName: schedule?.customerName || formData?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                foremanName: schedule?.foremanName || '',
                projectName: formData?.projectTitle || formData?.projectName || '',
                date: localeDateString(target.date) || new Date().toLocaleDateString(),
                day: new Date(target.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' })
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
                    const empName = normalizedEmployees.find(e => e.value === sig.employee)?.label || sig.employee;
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
                toast.success('PDF Downloaded');
            } else {
                toast.error('Failed to download PDF');
            }
        } catch (e) { console.error(e); } finally { 
            if (setCardDownloading) setCardDownloading(false);
            else setIsGeneratingJHAPDF(false); 
        }
    };

    const handleEmailJHA = (jha: any) => {
        setSelectedJHA(jha);
        setEmailTo(jha.clientEmail || formData?.contactEmail || '');
        setEmailModalOpen(true);
    };

    const handleConfirmEmailJHA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJHA || !emailTo) return;

        setIsSendingEmail(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            let schedule = estimateSchedules.find(s => s._id === selectedJHA.schedule_id);
            if (!schedule && selectedJHA.scheduleRef) {
                schedule = typeof selectedJHA.scheduleRef === 'string' ? null : selectedJHA.scheduleRef;
            }
            if (!schedule) {
                // Mock a schedule object for getClientName
                schedule = { customerName: formData?.customerName };
            }
            
            const clientName = schedule?.customerName || formData?.customerName || '';

            const variables: any = { 
                ...selectedJHA, 
                customerName: clientName,
                date: new Date(selectedJHA.date || new Date()).toLocaleDateString() 
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
                    const empName = normalizedEmployees.find(e => e.value === sig.employee)?.label || sig.employee;
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
                        scheduleId: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id || ''
                    })
                });

                const emailData = await emailRes.json();
                if (emailData.success) {
                    toast.success('PDF emailed successfully!');
                    setEmailModalOpen(false);
                    setEmailTo('');
                    
                    const updatedJha = { ...selectedJHA, emailCounter: (selectedJHA.emailCounter || 0) + 1 };
                    setSelectedJHA(updatedJha);
                    setJhaRecords(prev => prev.map(j => j._id === updatedJha._id ? updatedJha : j));
                } else {
                    toast.error(emailData.error || 'Failed to email PDF');
                }
                setIsSendingEmail(false);
            };
        } catch (e: any) {
            console.error('Email PDF Error:', e);
            toast.error(e.message || 'Failed to email PDF');
            setIsSendingEmail(false);
        }
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
            const res = await fetch('/api/djt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveDJT', payload }) });
            const data = await res.json();
            if (data.success) {
                toast.success('DJT Saved');
                setDjtModalOpen(false);
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to save DJT');
        } catch (e) { console.error(e); toast.error('Error saving DJT'); }
    };

    const handleDeleteDJT = async (djt: any) => {
        if (!confirm('Are you sure you want to delete this Job Ticket?')) return;
        try {
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteDJT', payload: { id: djt._id } })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Job Ticket deleted successfully');
                refetchJobDocs();
            } else toast.error('Failed to delete Job Ticket');
        } catch (err) { toast.error('Error deleting job ticket'); }
    };

    const handleDownloadDJTPdf = async (djt: any) => {
        setIsGeneratingDJTPDF(true);
        try {
            const scheduleMatch = estimateSchedules.find(s => String(s._id) === String(djt.schedule_id)) || djt.scheduleRef;
            const variables = getDJTPdfVariablesBase(djt, scheduleMatch || {}, formData || {}, formData?.clientName || '', normalizedEmployees);
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });
            if (!response.ok) throw new Error('Failed to generate PDF');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `DJT_${variables.customerName || 'Client'}_${variables.date || 'Date'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            toast.success('Successfully downloaded Job Ticket PDF');
        } catch (e: any) {
            toast.error(e.message || 'Failed to download PDF');
        } finally { setIsGeneratingDJTPDF(false); }
    };

    const handleEmailDJTOpen = (djt: any) => {
        setSelectedDJT(djt);
        setDjtEmailTo(djt.clientEmail || formData?.contactEmail || '');
        setDjtEmailModalOpen(true);
    };

    const handleConfirmEmailDJT = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDJT || !djtEmailTo) return;
        setIsSendingDjtEmail(true);
        try {
            const scheduleMatch = estimateSchedules.find(s => String(s._id) === String(selectedDJT.schedule_id)) || selectedDJT.scheduleRef;
            const variables = getDJTPdfVariablesBase(selectedDJT, scheduleMatch || {}, formData || {}, formData?.clientName || '', normalizedEmployees);
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const pdfRes = await fetch('/api/generate-google-pdf', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!pdfRes.ok) throw new Error('Failed to generate PDF');
            const blob = await pdfRes.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const emailRes = await fetch('/api/email-jha', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: djtEmailTo,
                        pdfBase64: base64data,
                        docName: 'Job Ticket',
                        projectName: variables.projectName || variables.customerName || 'Project'
                    })
                });
                const data = await emailRes.json();
                if (data.success) {
                    toast.success('Email sent successfully!');
                    setDjtEmailModalOpen(false);
                } else toast.error('Failed to send email');
                setIsSendingDjtEmail(false);
            };
        } catch (err) {
            toast.error('Failed to send email');
            setIsSendingDjtEmail(false);
        }
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
                date: localeDateString(selectedDJT.date || schedule?.fromDate) || new Date().toLocaleDateString(),
                day: (toLocalDate(selectedDJT.date || schedule?.fromDate) || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
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
    const POTHOLE_TEMPLATE_ID = '1wB2BrBGgkX_tVSJ0YsfFpEMuhKRLf0eQjs5tf9d27zI';

    const handleViewPotholeLog = (log: any) => {
        router.push(`/docs/pothole-logs/${log._id}`);
    };

    const handleEditPotholeLog = (log: any) => {
        setEditingPotholeLog(log);
        setPotholeEditOpen(true);
    };

    const handleDeletePotholeLog = (log: any) => {
        setPotholeLogToDelete(log);
    };

    const confirmDeletePotholeLog = async () => {
        if (!potholeLogToDelete) return;
        try {
            const res = await fetch('/api/pothole-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePotholeLog', payload: { id: potholeLogToDelete._id } })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Pothole Log deleted');
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to delete');
        } catch (e) { console.error(e); toast.error('Error deleting pothole log'); }
        finally { setPotholeLogToDelete(null); }
    };

    const handleDownloadPotholeLogPDF = async (log: any, setDownloading: (b: boolean) => void) => {
        setDownloading(true);
        try {
            const dateStr = log.date && !isNaN(new Date(log.date).getTime()) ? formatWallDate(log.date) : '';
            const variables: Record<string, any> = {
                date: dateStr,
                estimate: formData?.estimate || log.estimate || '',
                projectName: formData?.projectName || '',
                jobAddress: log.jobAddress || log.projectionLocation || formData?.jobAddress || '',
                createdBy: normalizedEmployees.find(e => e.value === log.createdBy)?.label || log.createdBy || '',
                totalPotholes: String(log.potholeItems?.length || 0),
                customerName: formData?.customerName || '',
                customerJobNo: formData?.customerJobNo || '',
            };
            const items = (log.potholeItems || []).map((item: any, idx: number) => ({
                potholeNo: item.potholeNo || String(idx + 1),
                typeOfUtility: item.typeOfUtility || '',
                soilType: item.soilType || '',
                topDepthOfUtility: item.topDepthOfUtility || '',
                bottomDepthOfUtility: item.bottomDepthOfUtility || '',
                pin: item.pin || '',
                latitude: item.latitude,
                longitude: item.longitude,
                photos: item.photos || [],
                photo1: item.photo1,
                photo2: item.photo2,
            }));

            const response = await fetch('/api/generate-pothole-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: POTHOLE_TEMPLATE_ID, variables, items })
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `Pothole_Log_${formData?.estimate || log.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success('PDF downloaded');
            } else {
                throw new Error('Failed to generate PDF');
            }
        } catch (e) { console.error(e); toast.error('Failed to download PDF'); }
        finally { setDownloading(false); }
    };

    const handleEmailPotholeLog = async (log: any) => {
        const email = prompt('Enter recipient email address:');
        if (!email) return;
        try {
            toast.loading('Generating & sending...', { id: 'pothole-email' });
            const dateStr = log.date && !isNaN(new Date(log.date).getTime()) ? formatWallDate(log.date) : '';
            const variables: Record<string, any> = {
                date: dateStr,
                estimate: formData?.estimate || log.estimate || '',
                projectName: formData?.projectName || '',
                jobAddress: log.jobAddress || log.projectionLocation || formData?.jobAddress || '',
                createdBy: normalizedEmployees.find(e => e.value === log.createdBy)?.label || log.createdBy || '',
                totalPotholes: String(log.potholeItems?.length || 0),
                customerName: formData?.customerName || '',
                customerJobNo: formData?.customerJobNo || '',
            };
            const items = (log.potholeItems || []).map((item: any, idx: number) => ({
                potholeNo: item.potholeNo || String(idx + 1),
                typeOfUtility: item.typeOfUtility || '',
                soilType: item.soilType || '',
                topDepthOfUtility: item.topDepthOfUtility || '',
                bottomDepthOfUtility: item.bottomDepthOfUtility || '',
                pin: item.pin || '',
                latitude: item.latitude,
                longitude: item.longitude,
                photos: item.photos || [],
                photo1: item.photo1,
                photo2: item.photo2,
            }));

            const res = await fetch('/api/email-pothole-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailTo: email,
                    subject: `Pothole Log Report - ${formData?.estimate || log.estimate || 'Report'}`,
                    emailBody: `Please find attached the Pothole Log Report for estimate ${formData?.estimate || log.estimate || ''}.`,
                    potholeLogId: log._id,
                    pdfPayload: { templateId: POTHOLE_TEMPLATE_ID, variables, items },
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Email sent!', { id: 'pothole-email' });
            } else {
                throw new Error(data.error || 'Failed to send');
            }
        } catch (e: any) { console.error(e); toast.error(e.message || 'Failed to send email', { id: 'pothole-email' }); }
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
    const PRE_BORE_TEMPLATE_ID = '1oz3s9qdfMnMdEivJhr8T4qPS-lwVGsb1A79eB-Djgic';

    const handleViewPreBoreLog = (pb: any) => {
        // Pre-bore logs use composite ID: scheduleId___legacyId
        const schedId = pb.scheduleId || pb._scheduleId || '';
        const pbId = pb.legacyId || pb._id || '';
        if (schedId && pbId) {
            router.push(`/docs/pre-bore-logs/${schedId}___${pbId}`);
        } else {
            setSelectedPreBoreLog(pb);
            setPreBoreModalOpen(true);
        }
    };

    const handleDeletePreBoreLog = async (pb: any) => {
        if (!confirm('Are you sure you want to delete this pre-bore log?')) return;
        try {
            const schedId = pb.scheduleId || pb._scheduleId || '';
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePreBoreLog', payload: { id: schedId, legacyId: pb.legacyId } })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Pre-Bore Log deleted');
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to delete');
        } catch (e) { console.error(e); toast.error('Error deleting pre-bore log'); }
    };

    const handleDownloadPreBoreLogPDF = async (pb: any, setDownloading: (b: boolean) => void) => {
        setDownloading(true);
        try {
            const dateStr = pb.date && !isNaN(new Date(pb.date).getTime()) ? formatWallDate(pb.date) : '';
            const variables: Record<string, any> = {
                date: dateStr,
                start_time: pb.startTime || '',
                estimate: pb.estimate || formData?.estimate || '',
                customer_name: pb.customerName || pb.scheduleCustomerName || formData?.customerName || '',
                customer_foreman: pb.customerForeman || '',
                customer_work_request: pb.customerWorkRequestNumber || '',
                devco_operator: pb.devcoOperator || '',
                address_bore_start: pb.addressBoreStart || '',
                address_bore_end: pb.addressBoreEnd || '',
                drill_size: pb.drillSize || '',
                pilot_bore_size: pb.pilotBoreSize || '',
                reamer_size_6: pb.reamerSize6 || '',
                reamer_size_8: pb.reamerSize8 || '',
                reamer_size_10: pb.reamerSize10 || '',
                reamer_size_12: pb.reamerSize12 || '',
                reamers: pb.reamers || [pb.reamerSize6, pb.reamerSize8, pb.reamerSize10, pb.reamerSize12].filter(Boolean).map((s: string) => `${s}"`).join(', ') || '',
                soil_type: pb.soilType || '',
                bore_length: pb.boreLength || '',
                pipe_size: pb.pipeSize || '',
                foreman_signature: pb.foremanSignature || '',
                customer_signature: pb.customerSignature || '',
                total_rods: String(pb.preBoreLogs?.length || 0),
                created_by: normalizedEmployees.find(e => e.value === pb.createdBy)?.label || pb.createdBy || '',
            };
            const items = (pb.preBoreLogs || []).map((item: any, idx: number) => ({
                rodNumber: item.rodNumber || String(idx + 1),
                distance: item.distance || '',
                topDepth: item.topDepth || '',
                bottomDepth: item.bottomDepth || '',
                overOrUnder: item.overOrUnder || '',
                existingUtilities: item.existingUtilities || '',
                picture: item.picture || '',
            }));

            const response = await fetch('/api/generate-prebore-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: PRE_BORE_TEMPLATE_ID, variables, items })
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `Pre_Bore_Log_${formData?.estimate || pb.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success('PDF downloaded');
            } else {
                throw new Error('Failed to generate PDF');
            }
        } catch (e) { console.error(e); toast.error('Failed to download PDF'); }
        finally { setDownloading(false); }
    };

    const handleEmailPreBoreLog = async (pb: any) => {
        const email = prompt('Enter recipient email address:');
        if (!email) return;
        try {
            toast.loading('Generating & sending...', { id: 'prebore-email' });
            const dateStr = pb.date && !isNaN(new Date(pb.date).getTime()) ? formatWallDate(pb.date) : '';
            const variables: Record<string, any> = {
                date: dateStr,
                start_time: pb.startTime || '',
                estimate: pb.estimate || formData?.estimate || '',
                customer_name: pb.customerName || pb.scheduleCustomerName || formData?.customerName || '',
                customer_foreman: pb.customerForeman || '',
                customer_work_request: pb.customerWorkRequestNumber || '',
                devco_operator: pb.devcoOperator || '',
                address_bore_start: pb.addressBoreStart || '',
                address_bore_end: pb.addressBoreEnd || '',
                drill_size: pb.drillSize || '',
                pilot_bore_size: pb.pilotBoreSize || '',
                soil_type: pb.soilType || '',
                bore_length: pb.boreLength || '',
                pipe_size: pb.pipeSize || '',
                foreman_signature: pb.foremanSignature || '',
                customer_signature: pb.customerSignature || '',
                total_rods: String(pb.preBoreLogs?.length || 0),
                created_by: normalizedEmployees.find(e => e.value === pb.createdBy)?.label || pb.createdBy || '',
            };
            const items = (pb.preBoreLogs || []).map((item: any, idx: number) => ({
                rodNumber: item.rodNumber || String(idx + 1),
                distance: item.distance || '',
                topDepth: item.topDepth || '',
                bottomDepth: item.bottomDepth || '',
                overOrUnder: item.overOrUnder || '',
                existingUtilities: item.existingUtilities || '',
                picture: item.picture || '',
            }));

            const res = await fetch('/api/email-prebore-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailTo: email,
                    subject: `Pre-Bore Log Report - ${formData?.estimate || pb.estimate || 'Report'}`,
                    emailBody: `Please find attached the Pre-Bore Log Report.`,
                    pdfPayload: { templateId: PRE_BORE_TEMPLATE_ID, variables, items },
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Email sent!', { id: 'prebore-email' });
            } else {
                throw new Error(data.error || 'Failed to send');
            }
        } catch (e: any) { console.error(e); toast.error(e.message || 'Failed to send email', { id: 'prebore-email' }); }
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

    // --- Vendor & Subs Handlers ---
    const handleCreateVendorSubs = async () => {
        if (!newVendorSubs.type || !newVendorSubs.vendorSubName || !newVendorSubs.fileName) {
            toast.error('Type, Vendor/Sub Name, and File Name are required');
            return;
        }
        try {
            const res = await fetch('/api/vendor-subs-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createVendorSubsDoc',
                    payload: { ...newVendorSubs, estimate: formData?.estimate, createdBy: currentUser?.email || '' }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Record added');
                setIsVendorSubsModalOpen(false);
                setNewVendorSubs({ type: '', vendorSubName: '', fileName: '', files: [] });
                const vsRes = await fetch('/api/vendor-subs-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getVendorSubsDocs', payload: { estimate: formData?.estimate } }) });
                const vsData = await vsRes.json();
                if (vsData.success) setVendorSubsDocs(vsData.result || []);
            } else toast.error(data.error || 'Failed to create');
        } catch (e) { console.error(e); toast.error('Error creating record'); }
    };

    const handleDeleteVendorSubs = async (id: string) => {
        try {
            await fetch('/api/vendor-subs-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteVendorSubsDoc', payload: { id } })
            });
            setVendorSubsDocs(prev => prev.filter(d => d._id !== id));
            setVendorSubsToDelete(null);
            setSelectedVendorSubsDoc(null);
            toast.success('Record deleted');
        } catch (e) { toast.error('Error deleting'); }
    };

    const handleVendorSubsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsVendorSubsUploading(true);
        const uploaded = [...newVendorSubs.files];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/vendor-subs`);
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success && data.url) {
                    uploaded.push({ url: data.url, thumbnailUrl: data.thumbnailUrl || '', fileName: file.name, fileType: file.type, uploadedBy: currentUser?.email || '', uploadedAt: new Date().toISOString() });
                }
            } catch (err) { console.error(err); toast.error(`Error uploading ${file.name}`); }
        }
        setNewVendorSubs(prev => ({ ...prev, files: uploaded }));
        setIsVendorSubsUploading(false);
        e.target.value = '';
    };

    const prelimDocs = [
        '20 Day Prelim',
        'COI - Certificate of Insurance',
        'Legal Docs',
        'Mechanics Lien',
        'Intent to Lien',
        'Stop Payment Notice'
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
    const receiptsAndCosts = useMemo(() => {
        const currentData = formData?.receiptsAndCosts || [];
        const historic = aggregatedReceipts || [];
        
        let allR: any[] = [...currentData];
        const currentIds = new Set(currentData.map((r: any) => r._id).filter(Boolean));
        const currentKeys = new Set(currentData.map((r: any) => `${r.vendor}|${r.amount}|${r.date}|${r.remarks}`));
        
        for (const h of historic) {
            if (h._id && currentIds.has(h._id)) continue;
            if (!h._id && currentKeys.has(`${h.vendor}|${h.amount}|${h.date}|${h.remarks}`)) continue;
            allR.push(h);
        }
        
        return allR.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }, [formData?.receiptsAndCosts, aggregatedReceipts]);


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
    const [pendingPayrollUpload, setPendingPayrollUpload] = useState<{ docName: string, files: FileList } | null>(null);
    const [payrollDescription, setPayrollDescription] = useState('');

    const handlePayrollDocUpload = async (docName: string, files: FileList, description: string) => {
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
                        description: description,
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

    // Stop Payment Notice Upload State (Multiple Files)
    const stopPaymentInputRef = React.useRef<HTMLInputElement>(null);
    const [isStopPaymentUploading, setIsStopPaymentUploading] = useState(false);
    const stopPaymentDocs = (formData?.stopPaymentNoticeDocs || []) as { url: string; name: string; type: string; uploadedAt: string; uploadedBy?: string; uploadedByName?: string }[];

    const handleStopPaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !onUpdate) return;

        setIsStopPaymentUploading(true);

        // Resolve uploader name
        const userEmail = currentUser?.email?.toLowerCase();
        const loggedInEmp = employees.find(
            (emp: any) => (emp.email || '').toLowerCase() === userEmail || (emp._id || '').toLowerCase() === userEmail
        );
        const uploaderName = loggedInEmp
            ? `${loggedInEmp.firstName || ''} ${loggedInEmp.lastName || ''}`.trim()
            : (currentUser as any)?.name || currentUser?.email || '';

        const uploaded: { url: string; thumbnailUrl?: string; name: string; type: string; uploadedAt: string; uploadedBy: string; uploadedByName: string }[] = [...stopPaymentDocs] as any;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/stop-payment-notice`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploaded.push({
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        name: file.name,
                        type: file.type,
                        uploadedAt: new Date().toISOString(),
                        uploadedBy: currentUser?.email || '',
                        uploadedByName: uploaderName
                    });
                }
            }

            onUpdate('stopPaymentNoticeDocs', uploaded);
            toast.success(`${files.length} file(s) uploaded successfully`);
        } catch (err) {
            console.error('Stop Payment Notice Upload Error:', err);
            toast.error('Error uploading stop payment notice documents');
        } finally {
            setIsStopPaymentUploading(false);
            if (stopPaymentInputRef.current) stopPaymentInputRef.current.value = '';
        }
    };

    const removeStopPaymentDoc = (index: number) => {
        if (!onUpdate) return;
        const updated = stopPaymentDocs.filter((_, i) => i !== index);
        onUpdate('stopPaymentNoticeDocs', updated);
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
                    // Sort: CP first, then CF, then UP, then UF
                    const relOrder: Record<string, number> = { 'CP': 0, 'CF': 1, 'UP': 2, 'UF': 3 };
                    constants.sort((a: any, b: any) => {
                        const aCode = a.value?.startsWith('CP') ? 'CP' : a.value?.startsWith('CF') ? 'CF' : a.value?.startsWith('UP') ? 'UP' : a.value?.startsWith('UF') ? 'UF' : 'ZZ';
                        const bCode = b.value?.startsWith('CP') ? 'CP' : b.value?.startsWith('CF') ? 'CF' : b.value?.startsWith('UP') ? 'UP' : b.value?.startsWith('UF') ? 'UF' : 'ZZ';
                        return (relOrder[aCode] ?? 99) - (relOrder[bCode] ?? 99);
                    });
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
    const billingTickets = isBillingAggregated ? aggregatedBillingTickets : (formData?.billingTickets || []);
    const [isBillingTicketModalOpen, setIsBillingTicketModalOpen] = useState(false);
    const [isBillingTermsOpen, setIsBillingTermsOpen] = useState(false);
    const [editingBillingTicketIndex, setEditingBillingTicketIndex] = useState<number | null>(null);
    const [billingTicketToDelete, setBillingTicketToDelete] = useState<number | null>(null);
    const [isBillingTicketUploading, setIsBillingTicketUploading] = useState(false);

    // Billing Ticket Sent Date State
    const [billingTicketSentDateOpen, setBillingTicketSentDateOpen] = useState(false);
    const [billingTicketSentDateIndex, setBillingTicketSentDateIndex] = useState<number | null>(null);
    const [billingTicketSentDateValue, setBillingTicketSentDateValue] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [billingTicketSentDateSaving, setBillingTicketSentDateSaving] = useState(false);

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

    const handleOpenBillingTicketSentDate = (idx: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setBillingTicketSentDateIndex(idx);
        setBillingTicketSentDateValue(format(new Date(), 'yyyy-MM-dd'));
        setBillingTicketSentDateOpen(true);
    };

    const handleConfirmBillingTicketSentDate = async () => {
        if (billingTicketSentDateIndex === null || !onUpdate) return;
        setBillingTicketSentDateSaving(true);
        try {
            const dateToSave = new Date(billingTicketSentDateValue + 'T12:00:00').toISOString();
            const updated = billingTickets.map((t: any, i: number) =>
                i === billingTicketSentDateIndex ? { ...t, sentDate: dateToSave } : t
            );
            onUpdate('billingTickets', updated);
            toast.success('Marked as sent');
            setBillingTicketSentDateOpen(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update sent date');
        } finally {
            setBillingTicketSentDateSaving(false);
        }
    };

    const handleClearBillingTicketSentDate = (idx: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!onUpdate) return;
        const updated = billingTickets.map((t: any, i: number) =>
            i === idx ? { ...t, sentDate: '' } : t
        );
        onUpdate('billingTickets', updated);
        toast.success('Sent date cleared');
    };

    const handleAddBillingTicket = () => {
        setNewBillingTicket({
            date: format(new Date(), 'yyyy-MM-dd'),
            billingTerms: '',
            otherBillingTerms: '',
            uploads: [],
            titleDescriptions: [{ title: '', description: '' }],
            lumpSum: '',
            createdBy: currentUser?.email || currentUser?.userId || (Array.isArray(formData?.proposalWriter) ? formData.proposalWriter.join(', ') : (formData?.proposalWriter || ''))
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
            createdBy: Array.isArray(item.createdBy) ? item.createdBy.join(', ') : (item.createdBy || '')
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

        const isNew = editingBillingTicketIndex === null;

        let updated;
        if (!isNew) {
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

        // Sanitize all billing tickets to ensure createdBy is always a string (fixes existing bad data)
        const sanitized = updated.map((t: any) => ({
            ...t,
            createdBy: Array.isArray(t.createdBy) ? t.createdBy.join(', ') : (t.createdBy || '')
        }));

        onUpdate('billingTickets', sanitized);
        setIsBillingTicketModalOpen(false);
        setEditingBillingTicketIndex(null);
        toast.success(isNew ? 'Billing ticket added' : 'Billing ticket updated');

        // Auto-create ToDo for new billing tickets only
        if (isNew) {
            (async () => {
                try {
                    const todayStr = new Date().toLocaleDateString('en-US');
                    const titlesList = (cleanedTitleDescriptions || [])
                        .filter((td: any) => td.title?.trim())
                        .map((td: any) => td.title.trim())
                        .join(', ');
                    const lumpSumFormatted = ticketData.lumpSum
                        ? `$${parseFloat(String(ticketData.lumpSum).replace(/[^0-9.-]+/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '';

                    const taskDescription = [
                        `Billing Ticket Created`,
                        `Date: ${ticketData.date || todayStr}`,
                        `Estimate: ${formData?.estimate || 'N/A'}`,
                        `Customer: ${formData?.customerName || 'N/A'}`,
                        `Job Address: ${formData?.jobAddress || 'N/A'}`,
                        ticketData.billingTerms ? `Billing Terms: ${ticketData.billingTerms === 'Other' ? (ticketData.otherBillingTerms || 'Other') : ticketData.billingTerms}` : '',
                        lumpSumFormatted ? `Lump Sum: ${lumpSumFormatted}` : '',
                        titlesList ? `Titles: ${titlesList}` : '',
                    ].filter(Boolean).join('\n');

                    await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            task: taskDescription,
                            assignees: billingTicketAssignees,
                            status: 'todo',
                            dueDate: formatWallDate(new Date()),
                            estimate: formData?.estimate || '',
                            customerName: formData?.customerName || '',
                            jobAddress: formData?.jobAddress || '',
                        })
                    });
                } catch (todoErr) {
                    console.error('Failed to create billing ticket todo:', todoErr);
                }
            })();
        }
    };

    const confirmRemoveBillingTicket = () => {
        if (!onUpdate || billingTicketToDelete === null) return;
        const updated = billingTickets.filter((_: any, i: number) => i !== billingTicketToDelete);

        // Immediately update the aggregated state so UI reflects the deletion right away
        // (prevents the stale useEffect refetch from re-adding the deleted ticket)
        setAggregatedBillingTickets(updated);

        // Sanitize createdBy to prevent CastError
        const sanitized = updated.map((t: any) => ({
            ...t,
            createdBy: Array.isArray(t.createdBy) ? t.createdBy.join(', ') : (t.createdBy || '')
        }));

        onUpdate('billingTickets', sanitized);
        setBillingTicketToDelete(null);
        toast.success('Billing ticket removed');

        // Background save — fire and forget so UI stays responsive
        if (formData?.estimate) {
            // Get the _id for this estimate version
            const estId = (formData as any)?._id;
            if (estId) {
                fetch(`/api/estimates/${estId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ billingTickets: sanitized })
                        }).catch(err => console.error('Background billing ticket save failed:', err));
            }
        }
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
                String(e.value || e.email || '').toLowerCase() === String(email || '').toLowerCase()
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
            if (process.env.NODE_ENV !== 'production') console.log('[EstimateChat] safeAssignees:', safeAssignees, 'chatAssignees raw:', chatAssignees);
            if (safeAssignees.length > 0) {
                if (process.env.NODE_ENV !== 'production') console.log('[EstimateChat] Creating task for assignees:', safeAssignees);
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

    const getEmployeeData = (idOrEmail: any) => {
        if (!idOrEmail) return null;
        // Handle arrays (e.g. createdBy could be an array)
        const raw = Array.isArray(idOrEmail) ? idOrEmail[0] : idOrEmail;
        if (!raw) return null;
        const lower = String(raw).toLowerCase();
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
        }).sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
    }, [employees]);

    // Admin-only employees for "Paid By" dropdown
    const adminEmployeeOptions = useMemo(() => {
        return employees
            .filter(emp => emp.appRole === 'Admin' || emp.appRole === 'Super Admin')
            .map(emp => {
                const label = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || emp._id;
                return {
                    id: emp._id,
                    label: label,
                    value: emp.email || emp._id || emp.value,
                    profilePicture: emp.image || emp.profilePicture
                };
            }).sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
    }, [employees]);

    const filteredChatOptions = useMemo(() => {
        const source = employeeOptions;
        if (!mentionQuery) return source.slice(0, 100);
        return source.filter(e => String(e.label || '').toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 50);
    }, [mentionQuery, employeeOptions]);


    // Robust employee finder - handles arrays, case-insensitive, matches _id or email
    const findEmployeeByIdOrEmail = (idOrEmail: any): Employee | undefined => {
        if (!idOrEmail || employees.length === 0) return undefined;
        // If array, take first element
        const val = Array.isArray(idOrEmail) ? idOrEmail[0] : idOrEmail;
        if (!val) return undefined;
        const normalized = String(val).toLowerCase().trim();
        return employees.find(e => {
            const eid = (e._id || '').toLowerCase().trim();
            const eemail = (e.email || '').toLowerCase().trim();
            return eid === normalized || eemail === normalized;
        });
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
                date: localeDateString(formData.date) || new Date().toLocaleDateString(),
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
                customerJobNumber: formData.customerJobNo || '',
                DIRProjectNo: formData.DIRProjectNo || '',

                // Grand Total - prefer live chartData (calculated from line items) over saved DB value
                grandTotal: (() => {
                    // 1. Try chartData.grandTotal first (live calculated value)
                    const liveGT = chartData?.grandTotal;
                    if (liveGT !== undefined && liveGT !== null && liveGT > 0) {
                        return `$${liveGT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }
                    // 2. Fallback to formData.grandTotal (saved DB value)
                    const gt = formData.grandTotal;
                    if (gt !== undefined && gt !== null && gt !== '') {
                        const num = parseFloat(String(gt).replace(/[^0-9.-]+/g, ''));
                        return !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                    }
                    return '';
                })(),

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

                // Get proposalWriter employee details (robust: handles arrays and case-insensitive matching)
                createdBy: (() => {
                    const emp = findEmployeeByIdOrEmail(formData.proposalWriter);
                    if (emp) return `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                    return '';
                })(),
                companyPosition: (() => {
                    const emp = findEmployeeByIdOrEmail(formData.proposalWriter);
                    return emp?.companyPosition || '';
                })(),
                position: (() => {
                    const emp = findEmployeeByIdOrEmail(formData.proposalWriter);
                    return emp?.companyPosition || '';
                })(),
                signature: (() => {
                    // 1. Try proposalWriter's signature
                    const emp = findEmployeeByIdOrEmail(formData.proposalWriter);
                    if (emp?.signature) {
                        if (process.env.NODE_ENV !== 'production') console.log('[DocGen] Using proposalWriter signature from:', emp._id);
                        return emp.signature;
                    }
                    // 2. Fallback to CFO signature
                    const cfo = findEmployeeByIdOrEmail('dt@devco-inc.com');
                    if (cfo?.signature) {
                        if (process.env.NODE_ENV !== 'production') console.log('[DocGen] Using CFO signature as fallback');
                        return cfo.signature;
                    }
                    console.warn('[DocGen] No signature found for proposalWriter or CFO');
                    return '';
                })(),
                cfoSignature: (() => {
                    const cfo = findEmployeeByIdOrEmail('dt@devco-inc.com');
                    return cfo?.signature || '';
                })(),
            };

            // Inject Intent to Lien specific fields
            if (docName === 'Intent to Lien' && itemIndex !== undefined) {
                const intentItem = intentToLienItems[itemIndex];
                if (intentItem) {
                    // Set {{today}} to the intent to lien's createdAt date
                    if (intentItem.createdAt) {
                        variables.today = localeDateString(intentItem.createdAt);
                    }

                    // Intent to Lien specific fields
                    variables.arBalance = intentItem.arBalance || '';
                    variables.fromDate = intentItem.fromDate ? localeDateString(intentItem.fromDate) : '';
                    variables.toDate = intentItem.toDate ? localeDateString(intentItem.toDate) : '';
                    variables.dueDate = intentItem.dueDate ? localeDateString(intentItem.dueDate) : '';
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
                    variables.today = localeDateString(releaseItem.createdAt);
                }

                // Ensure date formatting consistency
                if (releaseItem.date) {
                    variables.date = localeDateString(releaseItem.date);
                }

                if (releaseItem.amountOfCheck) {
                    const rawVal = String(releaseItem.amountOfCheck).replace(/[^0-9.-]+/g, '');
                    const num = parseFloat(rawVal);
                    const formatted = !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : releaseItem.amountOfCheck;
                    variables.amountOfCheck = formatted;
                    // Also set receivedProgressPayments for CP template compatibility
                    variables.receivedProgressPayments = formatted;
                    variables.receivedProgressPayment = formatted;
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

                // Inject Creator (Signer) details — robust lookup with fallback
                const creatorId = releaseItem.createdBy;
                const creatorEmployee = findEmployeeByIdOrEmail(creatorId);
                if (creatorEmployee) {
                    variables.createdBy = `${creatorEmployee.firstName || ''} ${creatorEmployee.lastName || ''}`.trim();
                    variables.companyPosition = creatorEmployee.companyPosition || '';
                    // Only override signature if the creator actually has one
                    if (creatorEmployee.signature) {
                        if (process.env.NODE_ENV !== 'production') console.log('[DocGen] Release: Using creator signature from:', creatorEmployee._id);
                        variables.signature = creatorEmployee.signature;
                    } else {
                        // Fallback to CFO signature if creator has no signature
                        const cfo = findEmployeeByIdOrEmail('dt@devco-inc.com');
                        if (cfo?.signature) {
                            if (process.env.NODE_ENV !== 'production') console.log('[DocGen] Release: Creator has no signature, falling back to CFO');
                            variables.signature = cfo.signature;
                        } else {
                            console.warn('[DocGen] Release: No signature found for creator or CFO');
                        }
                    }
                } else {
                    console.warn('[DocGen] Release: Could not find employee for createdBy:', creatorId);
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
                    variables.DatesOfWaiverRelease = releaseItem.DatesOfWaiverRelease.map((d: string) => localeDateString(d)).join(', ');
                }

                // Received Progress Payments array (for UP)
                if (releaseItem.receivedProgressPayments && Array.isArray(releaseItem.receivedProgressPayments)) {
                    const joined = releaseItem.receivedProgressPayments.map((val: any) => {
                        const rawVal = String(val).replace(/[^0-9.-]+/g, '');
                        const num = parseFloat(rawVal);
                        return !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val;
                    }).join(', ');
                    variables.receivedProgressPayments = joined;
                    variables.receivedProgressPayment = joined;
                }
            }

            // Inject Billing Ticket specific fields
            if (docName === 'Billing Ticket' && itemIndex !== undefined) {
                const billingItem = billingTickets[itemIndex];
                if (billingItem) {
                    variables.date = billingItem.date ? localeDateString(billingItem.date) : variables.date;
                    variables.day = billingItem.date ? format(toLocalDate(billingItem.date) || new Date(), 'EEEE') : format(new Date(), 'EEEE');
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

            // Open the PDF in a new tab
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');

            setGeneratingProgress(100);
            toast.success(`${docName} opened in new tab!`);
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

        // For old Cloudinary URLs, proxy through our API for reliable download
        if (url.includes('res.cloudinary.com')) {
            const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName || 'download')}`;
            window.open(proxyUrl, '_blank');
            return;
        }

        // For R2 and other URLs, open directly in a new tab
        window.open(url, '_blank');
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
                                        String(e.email || '').toLowerCase() === String(msg.sender || '').toLowerCase() ||
                                        e._id === msg.sender ||
                                        String(e.value || '').toLowerCase() === String(msg.sender || '').toLowerCase()
                                    );
                                    const senderLabel = senderEmp?.label || senderEmp?.firstName || msg.senderName || msg.sender || 'U';
                                    const senderInitials = senderLabel.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                                    const renderMessage = (text: string) => {
                                        const parts = text.split(/(@[\w.@]+)/g);
                                        return parts.map((part, i) => {
                                            if (part.startsWith('@')) {
                                                const label = part.slice(1);
                                                // Check if this person is already an assignee (hide them from text if they are)
                                                const isAssignee = msg.assignees?.some((assignee: any) => {
                                                    // Handle both string (email) and object ({email, name}) formats
                                                    const email = typeof assignee === 'string' ? assignee : assignee?.email || '';
                                                    const emp = employees.find(e =>
                                                        String(e.email || '').toLowerCase() === String(email || '').toLowerCase() ||
                                                        e._id === email ||
                                                        String(e.value || '').toLowerCase() === String(email || '').toLowerCase()
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
                                                            String(e.email || '').toLowerCase() === String(email || '').toLowerCase() ||
                                                            e._id === email ||
                                                            String(e.value || '').toLowerCase() === String(email || '').toLowerCase()
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

                                            <div id={msg._id} className={`rounded-2xl p-1 min-w-[160px] max-w-[85%] shadow-sm relative ${isMe
                                                ? 'bg-[#526D82] text-white rounded-br-none'
                                                : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'
                                                }`}>
                                                <HeaderContent />

                                                {/* Reply Citation */}
                                                {msg.replyTo && (
                                                    <div
                                                        onClick={() => document.getElementById(msg.replyTo._id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                                        className={`mb-2 mx-1 p-1.5 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${isMe
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
                        <input
                            type="file"
                            ref={stopPaymentInputRef}
                            onChange={handleStopPaymentUpload}
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
                                                                Uploaded {localeDateString(coiDocument.uploadedAt)}
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
                                                                    {localeDateString(doc.uploadedAt)}
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
                                                            key={`${item._id || 'item'}-${itemIdx}`}
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
                                                                        ? `${localeDateString(item.fromDate)} - ${localeDateString(item.toDate)}`
                                                                        : 'No date range'
                                                                    }
                                                                </span>
                                                                <span className="text-[9px] text-amber-500">
                                                                    Due: {item.dueDate ? localeDateString(item.dueDate) : '-'}
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

                                // Special handling for Stop Payment Notice
                                if (docName === 'Stop Payment Notice') {
                                    return (
                                        <div key={idx} className="group">
                                            <div
                                                onClick={() => stopPaymentInputRef.current?.click()}
                                                className={`
                                                    flex items-center justify-between p-3 rounded-xl cursor-pointer
                                                    ${stopPaymentDocs.length > 0
                                                        ? 'bg-rose-50 border border-rose-200'
                                                        : 'bg-white/50 hover:bg-white border border-transparent hover:border-slate-200'}
                                                    shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] transition-all duration-200
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isStopPaymentUploading ? (
                                                        <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                                                    ) : stopPaymentDocs.length > 0 ? (
                                                        <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                            {stopPaymentDocs.length}
                                                        </div>
                                                    ) : (
                                                        <Upload className="w-5 h-5 text-slate-400" />
                                                    )}
                                                    <span className={`text-xs font-bold ${stopPaymentDocs.length > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                                                        {docName}
                                                    </span>
                                                </div>
                                                <Plus className="w-4 h-4 text-rose-500" />
                                            </div>

                                            {/* List of uploaded stop payment notice docs */}
                                            {stopPaymentDocs.length > 0 && (
                                                <div className="mt-2 ml-4 space-y-1">
                                                    {stopPaymentDocs.map((doc, docIdx) => (
                                                        <div key={docIdx} className="flex items-center justify-between p-2 bg-rose-50/50 rounded-lg border border-rose-100">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <Paperclip className="w-3 h-3 text-rose-400 flex-shrink-0" />
                                                                <span className="text-[10px] text-rose-700 font-medium truncate">{doc.name}</span>
                                                                {(doc as any).uploadedByName && (
                                                                    <span className="text-[9px] text-rose-500 flex-shrink-0 flex items-center gap-0.5">
                                                                        <User className="w-2.5 h-2.5" />
                                                                        {(doc as any).uploadedByName}
                                                                    </span>
                                                                )}
                                                                <span className="text-[9px] text-rose-400 flex-shrink-0">
                                                                    {localeDateString(doc.uploadedAt)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleFileDownload(doc.url, doc.name);
                                                                    }}
                                                                    className="p-1 text-rose-500 hover:bg-rose-100 rounded transition-colors"
                                                                    title="Download Document"
                                                                >
                                                                    <Download className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        removeStopPaymentDoc(docIdx);
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

                                // ──── Special: 20 Day Prelim (Accordion) ────
                                if (docName === '20 Day Prelim') {
                                    return (
                                        <div key={idx} className="rounded-xl overflow-hidden">
                                            {/* Accordion Header */}
                                            <button
                                                onClick={() => setIsPrelimAccordionOpen(prev => !prev)}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${
                                                    prelimDocRecords.length > 0
                                                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]'
                                                        : 'bg-white/60 border border-slate-100 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] hover:border-blue-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <ChevronDown className={`w-4 h-4 text-blue-500 transition-transform duration-300 ${isPrelimAccordionOpen ? '' : '-rotate-90'}`} />
                                                    {loadingPrelimDocs ? (
                                                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                                                            {prelimDocRecords.length}
                                                        </div>
                                                    )}
                                                    <span className={`text-xs font-bold ${prelimDocRecords.length > 0 ? 'text-blue-700' : 'text-slate-600'}`}>
                                                        {docName}
                                                    </span>
                                                </div>
                                                {/* Plus Button — directly generates PDF */}
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleDirectGeneratePrelim(); }}
                                                    className={`p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-110 hover:shadow-lg cursor-pointer ${isGeneratingPrelim ? 'opacity-60 pointer-events-none' : ''}`}
                                                >
                                                    {isGeneratingPrelim ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                </div>
                                            </button>

                                            {/* Generating bar */}
                                            {isGeneratingPrelim && (
                                                <div className="mt-1 mx-2">
                                                    <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 rounded-full animate-pulse" style={{ width: '70%' }} />
                                                    </div>
                                                    <p className="text-[9px] text-blue-600 font-semibold mt-1 text-center animate-pulse">Generating PDF & storing in cloud...</p>
                                                </div>
                                            )}

                                            {/* Accordion Body */}
                                            {isPrelimAccordionOpen && prelimDocRecords.length > 0 && (
                                                <div className="mt-2 space-y-2.5 pl-1">
                                                    {prelimDocRecords.map((doc: any, docIdx: number) => (
                                                        <div
                                                            key={doc._id || docIdx}
                                                            className="group/item relative bg-white rounded-2xl border border-slate-200 hover:border-[#0F4C75]/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
                                                        >
                                                            <div className="p-5 flex flex-col gap-4 flex-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                                                                            <FileCheck className="w-5 h-5" />
                                                                        </div>
                                                                        <p className="text-base font-extrabold text-[#0F4C75] leading-tight line-clamp-1">{doc.docName || '20 Day Prelim'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Footer - Created By & Actions */}
                                                            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between mt-auto">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    {(() => {
                                                                        const creator = normalizedEmployees.find((e: any) => e.value === doc.createdByEmail || e.label === doc.createdByName);
                                                                        return (
                                                                            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0 shadow-inner flex items-center justify-center text-slate-500">
                                                                                {creator && creator.image ? (
                                                                                    <img src={creator.image} className="w-full h-full object-cover" alt={creator.label} />
                                                                                ) : (
                                                                                    <User size={12} className="text-slate-400" />
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    <span className="text-[12px] font-bold text-slate-600 truncate">{doc.createdByName || 'Unknown'}</span>
                                                                    <div className="w-1 h-1 rounded-full bg-slate-300 mx-0.5 shrink-0" />
                                                                    <span className="text-[11px] font-medium text-slate-500 shrink-0">
                                                                        {doc.generatedDate || (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US') : 'N/A')}
                                                                    </span>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                                    {/* Download Generated PDF */}
                                                                    {(doc.generatedFile?.url || doc.files?.[0]?.url) && (
                                                                        <button
                                                                            onClick={() => {
                                                                                const f = doc.generatedFile || doc.files?.[0];
                                                                                if (f?.url) handleFileDownload(f.url, f.fileName || '20_Day_Prelim.pdf');
                                                                            }}
                                                                            className="p-2 rounded-xl text-slate-400 hover:text-[#0F4C75] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
                                                                            title="Download Generated PDF"
                                                                        >
                                                                            <Download size={14} />
                                                                        </button>
                                                                    )}
                                                                    {/* Download Uploaded File */}
                                                                    {doc.uploadedFile?.url && (
                                                                        <button
                                                                            onClick={() => handleFileDownload(doc.uploadedFile.url, doc.uploadedFile.fileName || 'uploaded_file')}
                                                                            className="p-2 rounded-xl text-slate-400 hover:text-[#0F4C75] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
                                                                            title="Download Uploaded File"
                                                                        >
                                                                            <Download size={14} />
                                                                        </button>
                                                                    )}
                                                                    {/* Upload File */}
                                                                    {!doc.uploadedFile?.url && (
                                                                        <label className="p-2 rounded-xl text-slate-400 hover:text-[#0F4C75] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all cursor-pointer inline-flex items-center justify-center" title="Upload File">
                                                                            <input
                                                                                type="file"
                                                                                onChange={(e) => handlePrelimRecordUpload(doc._id, e)}
                                                                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                                                                className="hidden"
                                                                            />
                                                                            {(isPrelimUploading && prelimUploadingDocId === doc._id)
                                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                                : <Upload size={14} />
                                                                            }
                                                                        </label>
                                                                    )}
                                                                    {/* Delete */}
                                                                    <button
                                                                        onClick={() => setPrelimDocToDelete(doc._id)}
                                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-rose-100 transition-all"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
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
                    <div className="flex items-center justify-between gap-1 mb-2 mt-0.5">
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                                <Receipt className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <h4 className="text-sm font-bold text-indigo-700 tracking-tight">Billing Tickets</h4>
                                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-black">
                                    {billingTickets.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {(() => {
                                const total = billingTickets.reduce((sum: number, c: any) => sum + (parseFloat(String(c.lumpSum || c.amount || 0).replace(/[^0-9.-]+/g, "")) || 0), 0);
                                return (
                                    <div className="flex items-center gap-2.5 bg-white/90 px-2 py-1 rounded-lg shadow-sm border border-slate-100 shrink-0">
                                        <div className="text-center pl-0.5 pr-0.5">
                                            <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-[1px]">Total ({billingTickets.length})</p>
                                            <p className="text-[12px] font-black text-[#0F4C75] leading-none">${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                            <button
                                onClick={handleAddBillingTicket}
                                className="p-1.5 px-2 bg-indigo-100 text-indigo-600 rounded-[10px] hover:bg-indigo-200 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)] transition-colors shrink-0 flex items-center justify-center ml-0.5"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {billingTickets.length > 0 ? billingTickets.map((item: any, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={(e) => handleEditBillingTicket(idx, e)}
                                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group cursor-pointer hover:bg-slate-50 hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-3 overflow-hidden"
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

                                    {/* Row 1: type, date, amount */}
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3 max-w-[70%]">
                                            <span className="w-fit text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm bg-indigo-100 text-indigo-700 border border-indigo-200/50">
                                                {(!item.billingTerms || item.billingTerms === 'Other') ? (item.otherBillingTerms || item.billingTerms || 'BILLING TICKET') : item.billingTerms}
                                            </span>
                                            {item.date && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Date:</span>
                                                    <span className="text-sm font-bold text-slate-600">{safeFormatDate(item.date)}</span>
                                                </div>
                                            )}
                                        </div>
                                        {(item.lumpSum || item.amount) && (
                                            <span className="shrink-0 text-2xl font-black text-slate-900 tracking-tight">
                                                ${parseFloat(String(item.lumpSum || item.amount).replace(/[^0-9.-]+/g, "")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </div>

                                    {/* Row 2: Title / Description */}
                                    {item.titleDescriptions?.length > 0 && (
                                        <div className="text-sm text-slate-700 italic bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 overflow-y-auto max-h-28 mt-1">
                                            {item.titleDescriptions.map((td: any, tIdx: number) => (
                                                <div key={tIdx} className="mb-1 last:mb-0">
                                                    <span className="font-semibold">{td.title}</span>
                                                    {td.title && td.description && <span>: </span>}
                                                    <span>{td.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Row 3: Attachments */}
                                    {item.uploads?.length > 0 && (
                                        <div className="flex flex-col gap-2 mt-2 relative group/carousel">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left pt-1">
                                                    Attachments {item.uploads && `(${item.uploads.length})`}
                                                </span>
                                                {item.uploads.length > 2 && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); const c = e.currentTarget.parentElement?.parentElement?.nextElementSibling as HTMLElement; c?.scrollBy({ left: -200, behavior: 'smooth' }); }} className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500">
                                                            <ChevronLeft className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); const c = e.currentTarget.parentElement?.parentElement?.nextElementSibling as HTMLElement; c?.scrollBy({ left: 200, behavior: 'smooth' }); }} className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500">
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                                                {item.uploads.map((upload: any, uIdx: number) => {
                                                    const url = upload.url || '';
                                                    const name = upload.name || `File ${uIdx + 1}`;
                                                    const isPdf = url.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf');
                                                    const isImg = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.startsWith('data:image/');
                                                    const thumbUrl = upload.thumbnailUrl || (isImg ? url : null);
                                                    return (
                                                        <button
                                                            key={uIdx}
                                                            onClick={(e) => { e.stopPropagation(); handleFileDownload(url, name); }}
                                                            className="snap-start shrink-0 w-[180px] flex flex-col items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all group shadow-sm focus:outline-none relative overflow-hidden"
                                                        >
                                                            {thumbUrl ? (
                                                                <div className="w-full h-24 mb-2 rounded-lg bg-slate-100 overflow-hidden relative border border-slate-200/50">
                                                                    <Image fill sizes="180px" src={cld(thumbUrl, { w: 300, q: 'auto' })} alt="" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-24 mb-2 rounded-lg bg-indigo-50/50 border border-indigo-100/50 flex items-center justify-center group-hover:bg-indigo-100/50 transition-colors">
                                                                    <FileText className="w-8 h-8 text-indigo-300 group-hover:text-indigo-400 transition-colors" />
                                                                </div>
                                                            )}
                                                            <div className="w-full flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    <div className="shrink-0 w-5 h-5 rounded bg-indigo-100/50 flex items-center justify-center">
                                                                        {isImg ? <ImageIcon className="w-3 h-3 text-indigo-600" /> : <FileText className="w-3 h-3 text-indigo-600" />}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-slate-700 truncate text-left flex-1" title={name}>
                                                                        {name}
                                                                    </span>
                                                                </div>
                                                                <div className="shrink-0 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-300 group-hover:shadow-md transition-all">
                                                                    <Download className="w-3 h-3" />
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Row 4: createdBy, createdAt, actions */}
                                    <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TooltipProvider>
                                                {(() => {
                                                    const creator = getEmployeeData(item.createdBy);
                                                    return (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="relative w-6 h-6 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                                                                    {creator?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(creator.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : (item.createdBy?.[0]?.toUpperCase() || 'U')}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Created By: {creator?.label || item.createdBy}</p></TooltipContent>
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </TooltipProvider>
                                            <span className="text-xs font-bold text-slate-500 tracking-wide">{getEmployeeData(item.createdBy)?.label || item.createdBy || 'Unknown'}</span>
                                            {item.createdAt && (
                                                <span className="text-[10px] font-bold text-slate-400 tracking-wider ml-1">
                                                    {safeFormatDate(item.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* Inline Sent Status / Mark as Sent Button */}
                                            {item.sentDate ? (
                                                <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span className="text-[10px] font-bold text-emerald-600">
                                                        Sent {safeFormatDate(item.sentDate, 'MM/dd')}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleClearBillingTicketSentDate(idx, e); }}
                                                        className="ml-1 p-0.5 rounded-full text-emerald-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                        title="Clear sent date"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenBillingTicketSentDate(idx, e); }}
                                                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-300 transition-all shadow-sm"
                                                    title="Mark as Sent"
                                                >
                                                    <Send className="w-3 h-3" />
                                                    <span>Sent</span>
                                                </button>
                                            )}

                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDocClick('Billing Ticket', idx); }}
                                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center"
                                                title="Download PDF"
                                                disabled={generatingDoc === 'Billing Ticket' && generatingIndex === idx}
                                            >
                                                {generatingDoc === 'Billing Ticket' && generatingIndex === idx
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Download className="w-3.5 h-3.5" />
                                                }
                                            </button>

                                            <button onClick={(e) => { e.stopPropagation(); setBillingTicketToDelete(idx); }} className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-center" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
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

                    <input
                        ref={payrollUploadRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            if (payrollUploadingDoc && e.target.files?.length) {
                                setPendingPayrollUpload({ docName: payrollUploadingDoc, files: e.target.files });
                                setPayrollDescription('');
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
                                                        <div className="relative flex items-center gap-1.5">
                                                            {uploads[uploads.length - 1].uploaderImage ? (
                                                                <div className="relative w-4 h-4 rounded-full flex-shrink-0 overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                                    src={uploads[uploads.length - 1].uploaderImage}
                                                                    alt=""
                                                                    className="rounded-full object-cover flex-shrink-0 w-full h-full"
                                                                /></div>
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0">
                                                                    <User className="w-2.5 h-2.5 text-white" />
                                                                </div>
                                                            )}
                                                            <span className="text-[10px] text-emerald-600">
                                                                Uploaded {localeDateString(uploads[uploads.length - 1].uploadedAt)}
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
                                                        <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
                                                            {upload.uploaderImage ? (
                                                                <div className="relative w-5 h-5 rounded-full flex-shrink-0 overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                                    src={upload.uploaderImage}
                                                                    alt=""
                                                                    className="rounded-full object-cover flex-shrink-0 w-full h-full"
                                                                /></div>
                                                            ) : (
                                                                <Paperclip className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                                            )}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[10px] font-bold text-emerald-800 truncate max-w-[150px]" title={upload.description || upload.name}>
                                                                    {upload.description || upload.name || `File ${uIdx + 1}`}
                                                                </span>
                                                                {upload.description && upload.name && (
                                                                    <span className="text-[8px] font-medium text-emerald-600/80 truncate max-w-[150px]" title={upload.name}>
                                                                        {upload.name}
                                                                    </span>
                                                                )}
                                                                <span className="text-[8px] text-emerald-500">
                                                                    {upload.uploadedAt ? localeDateString(upload.uploadedAt) : ''}
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

                    {/* Payroll Document Description Modal */}
                    <Modal
                        isOpen={!!pendingPayrollUpload}
                        onClose={() => {
                            setPendingPayrollUpload(null);
                            setPayrollDescription('');
                            setPayrollUploadingDoc(null);
                            if (payrollUploadRef.current) payrollUploadRef.current.value = '';
                        }}
                        title="Upload Document(s)"
                        maxWidth="md"
                    >
                        <div className="space-y-4 pt-2 pb-2">
                            <p className="text-[11px] text-slate-600 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                You selected {pendingPayrollUpload?.files.length} file(s) for <strong className="text-emerald-700">{pendingPayrollUpload?.docName}</strong>.
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                                    Document Description (Optional)
                                </label>
                                <Input
                                    autoFocus
                                    placeholder="e.g. Week 12 Payroll, Final Release"
                                    value={payrollDescription}
                                    onChange={(e) => setPayrollDescription(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && pendingPayrollUpload) {
                                            handlePayrollDocUpload(pendingPayrollUpload.docName, pendingPayrollUpload.files, payrollDescription);
                                            setPendingPayrollUpload(null);
                                            setPayrollDescription('');
                                        }
                                    }}
                                />
                                <p className="text-[9px] text-slate-400 mt-1.5 ml-1">
                                    This description will be displayed alongside your document in the list.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setPendingPayrollUpload(null);
                                        setPayrollDescription('');
                                        setPayrollUploadingDoc(null);
                                        if (payrollUploadRef.current) payrollUploadRef.current.value = '';
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (pendingPayrollUpload) {
                                            handlePayrollDocUpload(pendingPayrollUpload.docName, pendingPayrollUpload.files, payrollDescription);
                                            setPendingPayrollUpload(null);
                                            setPayrollDescription('');
                                        }
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                >
                                    Upload {pendingPayrollUpload?.files.length} File(s)
                                </Button>
                            </div>
                        </div>
                    </Modal>

                </div>

                {/* Column 5: Planning */}
                <PlanningCard
                    planningDocs={jobPlanningDocs}
                    onUpdate={onUpdate}
                    formData={formData}
                    employees={employees}
                    currentUserEmail={currentUser?.email}
                    planningOptions={planningOptions}
                />

                {/* Column 6: Signed Contracts */}
                <SignedContractsCard
                    signedContracts={signedContracts}
                    onUpdate={onUpdate}
                    formData={formData}
                    employees={employees}
                    currentUserEmail={currentUser?.email}
                />

                {/* Column 7: Receipts & Costs */}
                <ReceiptsCard
                    receiptsAndCosts={receiptsAndCosts}
                    onUpdate={onUpdate}
                    formData={formData}
                    employees={employees}
                    currentUserEmail={currentUser?.email || ''}
                />

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
                                const schedule = jha.scheduleRef || estimateSchedules.find(s => s._id === jha.schedule_id);
                                const clientName = schedule?.customerName || formData?.customerName || 'Unknown Client';
                                return (
                                    <JHACard
                                        key={`${jha._id || 'jha'}-${idx}`}
                                        jha={jha}
                                        schedule={schedule}
                                        clientName={clientName}
                                        employees={normalizedEmployees}
                                        canViewEstimates={can(MODULES.ESTIMATES, ACTIONS.VIEW)}
                                        canEdit={can(MODULES.JHA, ACTIONS.EDIT)}
                                        canDelete={can(MODULES.JHA, ACTIONS.DELETE)}
                                        onView={handleViewJHA}
                                        onEdit={handleViewJHA}
                                        onDelete={() => {}} // No delete handler currently passed in estimate view
                                        onDownloadPDF={handleDownloadJHAPDF}
                                        onEmail={handleEmailJHA}
                                        router={router}
                                    />
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
                                const scheduleMatch = estimateSchedules.find(s => String(s._id) === String(djt.schedule_id)) || djt.scheduleRef;
                                return (
                                    <DJTCard
                                        key={djt._id || idx}
                                        djt={djt}
                                        schedule={scheduleMatch || {}}
                                        clientName={scheduleMatch?.customerName || formData?.clientName || 'Unknown Client'}
                                        employees={normalizedEmployees}
                                        equipmentItems={equipmentItems}
                                        canViewEstimates={can(MODULES.ESTIMATES, ACTIONS.VIEW)}
                                        canEdit={can(MODULES.ESTIMATES, ACTIONS.EDIT)}
                                        canDelete={can(MODULES.ESTIMATES, ACTIONS.DELETE)}
                                        onView={handleViewDJT}
                                        onEdit={can(MODULES.ESTIMATES, ACTIONS.EDIT) ? handleViewDJT : undefined}
                                        onDelete={can(MODULES.ESTIMATES, ACTIONS.DELETE) ? handleDeleteDJT : undefined}
                                        onDownloadPDF={handleDownloadDJTPdf}
                                        onEmail={handleEmailDJTOpen}
                                        router={router}
                                    />
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
                                <PotholeLogCard
                                    key={`${log._id || 'log'}-${idx}`}
                                    log={log}
                                    estimate={formData}
                                    employees={normalizedEmployees}
                                    canEdit={can(MODULES.JHA, ACTIONS.EDIT)}
                                    canDelete={can(MODULES.JHA, ACTIONS.DELETE)}
                                    onView={handleViewPotholeLog}
                                    onEdit={handleEditPotholeLog}
                                    onDelete={handleDeletePotholeLog}
                                    onDownloadPDF={handleDownloadPotholeLogPDF}
                                    onEmail={handleEmailPotholeLog}
                                    router={router}
                                />
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
                                <PreBoreLogCard
                                    key={`${pb.legacyId || pb._id || 'pb'}-${idx}`}
                                    log={pb}
                                    estimate={formData}
                                    employees={normalizedEmployees}
                                    canEdit={can(MODULES.JHA, ACTIONS.EDIT)}
                                    canDelete={can(MODULES.JHA, ACTIONS.DELETE)}
                                    onView={handleViewPreBoreLog}
                                    onEdit={handleViewPreBoreLog}
                                    onDelete={handleDeletePreBoreLog}
                                    onDownloadPDF={handleDownloadPreBoreLogPDF}
                                    onEmail={handleEmailPreBoreLog}
                                    router={router}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No pre-bore logs</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column: Vendor & Subs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                            <User className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-amber-700">Vendor &amp; Subs</h4>
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                            {vendorSubsDocs.length}
                        </span>
                        <button
                            onClick={() => { setNewVendorSubs({ type: '', vendorSubName: '', fileName: '', files: [] }); setIsVendorSubsModalOpen(true); }}
                            className="ml-auto w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors shadow-sm"
                            title="Add Vendor/Sub Record"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {loadingJobDocs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                                </div>
                            ) : vendorSubsDocs.length > 0 ? vendorSubsDocs.map((doc: any, idx: number) => (
                                <div
                                    key={doc._id || idx}
                                    onClick={() => setSelectedVendorSubsDoc(doc)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-amber-50/60 hover:shadow-md hover:border-amber-200 transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                {doc.type}
                                            </span>
                                            <p className="text-xs font-black text-slate-800 truncate mt-1">{doc.vendorSubName}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{doc.fileName}</p>
                                        </div>
                                        <Eye className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        {doc.files?.length > 0 && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                                                {doc.files.length} file{doc.files.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                                        <span className="text-[10px] text-slate-400 font-bold truncate">{doc.createdBy || '-'}</span>
                                        <button
                                            onClick={e => { e.stopPropagation(); setVendorSubsToDelete(doc._id); }}
                                            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No vendor/sub records</p>
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

            {/* Email JHA Modal */}
            <EmailModal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                emailTo={emailTo}
                setEmailTo={setEmailTo}
                handleEmailConfirm={handleConfirmEmailJHA}
                isSending={isSendingEmail}
                title="Email JHA Document"
            />

            {/* Email DJT Modal */}
            <EmailModal
                isOpen={djtEmailModalOpen}
                onClose={() => !isSendingDjtEmail && setDjtEmailModalOpen(false)}
                emailTo={djtEmailTo}
                setEmailTo={setDjtEmailTo}
                handleEmailConfirm={handleConfirmEmailDJT}
                isSending={isSendingDjtEmail}
                title="Email Job Ticket Document"
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
                                                                <a href={item.photo1} target="_blank" rel="noopener noreferrer" className="relative text-blue-500 hover:text-blue-700">
                                                                    <ImageIcon className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                            {item.photo2 && (
                                                                <a href={item.photo2} target="_blank" rel="noopener noreferrer" className="relative text-blue-500 hover:text-blue-700">
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

            {/* Pothole Log Create Modal — shared component */}
            <PotholeLogFormModal
                open={potholeCreateOpen}
                onClose={() => setPotholeCreateOpen(false)}
                defaultEstimate={formData ? {
                    _id: formData.estimate || formData._id || '',
                    estimate: formData.estimate,
                    projectName: formData.projectName,
                    jobAddress: formData.jobAddress,
                    customerName: formData.customerName || (activeClient as any)?.name || '',
                } : null}
                onSaved={() => {
                    // Refresh pothole log records for this estimate
                    const est = formData?.estimate;
                    if (!est) return;
                    fetch('/api/pothole-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getPotholeLogs', payload: { estimate: est } }) })
                        .then(r => r.json()).then(d => { if (d.success) setPotholeLogRecords(d.result || []); });
                }}
            />

            {/* Pothole Log Edit Modal — shared component */}
            <PotholeLogFormModal
                open={potholeEditOpen}
                onClose={() => { setPotholeEditOpen(false); setEditingPotholeLog(null); }}
                editingLog={editingPotholeLog ? {
                    _id: editingPotholeLog._id,
                    date: editingPotholeLog.date,
                    estimate: editingPotholeLog.estimate,
                    customerName: editingPotholeLog.customerName || formData?.customerName || (activeClient as any)?.name || '',
                    jobAddress: editingPotholeLog.jobAddress || editingPotholeLog.projectionLocation || '',
                    projectionLocation: editingPotholeLog.projectionLocation,
                    potholeItems: (editingPotholeLog.potholeItems || []).map((it: any) => ({
                        ...it,
                        latitude: it.latitude?.toString() || '',
                        longitude: it.longitude?.toString() || '',
                    })),
                    createdBy: editingPotholeLog.createdBy,
                } : null}
                defaultEstimate={formData ? {
                    _id: formData.estimate || formData._id || '',
                    estimate: formData.estimate,
                    projectName: formData.projectName,
                    jobAddress: formData.jobAddress,
                    customerName: formData.customerName || (activeClient as any)?.name || '',
                } : null}
                onSaved={() => {
                    setPotholeEditOpen(false);
                    setEditingPotholeLog(null);
                    const est = formData?.estimate;
                    if (!est) return;
                    fetch('/api/pothole-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getPotholeLogs', payload: { estimate: est } }) })
                        .then(r => r.json()).then(d => { if (d.success) setPotholeLogRecords(d.result || []); });
                }}
            />

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
                                    <div className="relative max-h-16 rounded overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(selectedPreBoreLog.foremanSignature, { w: 128, q: 'auto' })} alt="Foreman Signature" className="rounded border border-slate-200 w-full h-full" /></div>
                                </div>
                            )}
                            {selectedPreBoreLog.customerSignature && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Customer Signature</p>
                                    <div className="relative max-h-16 rounded overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(selectedPreBoreLog.customerSignature, { w: 128, q: 'auto' })} alt="Customer Signature" className="rounded border border-slate-200 w-full h-full" /></div>
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

            {/* Vendor & Subs Add Modal */}
            <Modal
                isOpen={isVendorSubsModalOpen}
                onClose={() => setIsVendorSubsModalOpen(false)}
                title="Add Vendor / Sub Record"
                maxWidth="xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsVendorSubsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateVendorSubs} disabled={!newVendorSubs.type || !newVendorSubs.vendorSubName || !newVendorSubs.fileName}>
                            Add Record
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 p-2">
                    {/* Type */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Type *</label>
                        <select
                            value={newVendorSubs.type}
                            onChange={e => setNewVendorSubs(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        >
                            <option value="">Select type...</option>
                            {VENDOR_SUBS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {/* Vendor/Sub Name */}
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Vendor / Sub Name *</label>
                        {(() => {
                            const attachedVS: any[] = (formData?.estimateVendorsSubContractors as any[]) || [];
                            if (attachedVS.length > 0) {
                                const vsOptions = attachedVS.map((v: any) => ({ id: v._id || v.name, label: `${v.name} — ${v.type}`, value: v.name }));
                                const selectedLabel = (() => {
                                    if (!newVendorSubs.vendorSubName) return null;
                                    const opt = vsOptions.find(o => o.value === newVendorSubs.vendorSubName);
                                    return opt ? opt.label : newVendorSubs.vendorSubName;
                                })();
                                return (
                                    <div>
                                        <button
                                            id="vendor-sub-name-dropdown-trigger"
                                            type="button"
                                            onClick={() => setIsVendorSubsNameOpen(o => !o)}
                                            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none text-left flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                                        >
                                            <span className={selectedLabel ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                                                {selectedLabel || 'Select vendor / sub...'}
                                            </span>
                                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        <MyDropDown
                                            isOpen={isVendorSubsNameOpen}
                                            onClose={() => setIsVendorSubsNameOpen(false)}
                                            options={vsOptions}
                                            selectedValues={newVendorSubs.vendorSubName ? [newVendorSubs.vendorSubName] : []}
                                            onSelect={(val) => {
                                                setNewVendorSubs(prev => ({ ...prev, vendorSubName: val }));
                                                setIsVendorSubsNameOpen(false);
                                            }}
                                            onAdd={async () => {
                                                setIsVendorSubsNameOpen(false);
                                                setIsVendorSubsModalOpen(false);
                                                onOpenVendorsModal?.();
                                            }}
                                            anchorId="vendor-sub-name-dropdown-trigger"
                                            showSearch
                                            placeholder="Search vendor / sub..."
                                            emptyMessage="No vendors attached to this estimate"
                                            modal
                                        />
                                    </div>
                                );
                            }
                            return (
                                <div className="space-y-2">
                                    <Input
                                        value={newVendorSubs.vendorSubName === '__other__' ? '' : newVendorSubs.vendorSubName}
                                        onChange={e => setNewVendorSubs(prev => ({ ...prev, vendorSubName: e.target.value }))}
                                        placeholder="e.g. ABC Electrical"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setIsVendorSubsModalOpen(false); onOpenVendorsModal?.(); }}
                                        className="text-[11px] font-bold text-[#0F4C75] hover:text-[#0a3a5a] flex items-center gap-1 transition-colors"
                                    >
                                        <span className="w-4 h-4 rounded bg-[#0F4C75]/10 flex items-center justify-center text-[#0F4C75]">+</span>
                                        Attach vendors / subs to this estimate first
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                    {/* File Name / Description */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">File Name / Description *</label>
                        <Input
                            value={newVendorSubs.fileName}
                            onChange={e => setNewVendorSubs(prev => ({ ...prev, fileName: e.target.value }))}
                            placeholder="e.g. COI Certificate 2026"
                        />
                    </div>
                    {/* File Upload */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Upload Files / Images</label>
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-amber-400 transition-colors">
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                onChange={handleVendorSubsFileUpload}
                                className="hidden"
                                id="vendor-subs-file-upload"
                            />
                            <label htmlFor="vendor-subs-file-upload" className="cursor-pointer">
                                {isVendorSubsUploading ? (
                                    <div className="flex items-center justify-center gap-2 text-slate-500">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-xs">Uploading...</span>
                                    </div>
                                ) : (
                                    <div>
                                        <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                                        <p className="text-xs text-slate-500">Click to upload files or images</p>
                                    </div>
                                )}
                            </label>
                        </div>
                        {newVendorSubs.files.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {newVendorSubs.files.map((f: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                                        <Paperclip className="w-3 h-3 text-amber-500 shrink-0" />
                                        <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-amber-700 font-medium truncate hover:underline flex-1">{f.fileName}</a>
                                        <button onClick={() => setNewVendorSubs(prev => ({ ...prev, files: prev.files.filter((_: any, fi: number) => fi !== i) }))} className="text-red-400 hover:text-red-600">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Vendor & Subs View Modal */}
            <Modal
                isOpen={!!selectedVendorSubsDoc}
                onClose={() => setSelectedVendorSubsDoc(null)}
                title="Vendor / Sub Record"
                maxWidth="xl"
                footer={
                    <div className="flex gap-3 justify-between w-full">
                        <Button variant="destructive" onClick={() => setVendorSubsToDelete(selectedVendorSubsDoc?._id)}>
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                        <Button variant="ghost" onClick={() => setSelectedVendorSubsDoc(null)}>Close</Button>
                    </div>
                }
            >
                {selectedVendorSubsDoc && (
                    <div className="space-y-4 p-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Type</p>
                                <span className="text-xs font-black px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{selectedVendorSubsDoc.type}</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Vendor / Sub Name</p>
                                <p className="text-sm font-bold text-slate-800">{selectedVendorSubsDoc.vendorSubName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">File Name</p>
                                <p className="text-sm font-bold text-slate-800">{selectedVendorSubsDoc.fileName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Added By</p>
                                <p className="text-sm font-bold text-slate-800">{selectedVendorSubsDoc.createdBy || '-'}</p>
                            </div>
                        </div>
                        {selectedVendorSubsDoc.files?.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Attachments ({selectedVendorSubsDoc.files.length})</p>
                                <div className="space-y-2">
                                    {selectedVendorSubsDoc.files.map((f: any, i: number) => (
                                        <div key={i} className="relative flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                            {f.fileType?.startsWith('image/') ? (
                                                <div className="relative w-10 h-10 rounded-lg overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(f.url, { w: 128, q: 'auto' })} alt={f.fileName} className="rounded-lg object-cover border border-amber-200 w-full h-full" /></div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                                    <FileText className="w-5 h-5 text-amber-600" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{f.fileName}</p>
                                            </div>
                                            <a href={f.url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors">
                                                <Download className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Vendor & Subs Confirm Delete */}
            <ConfirmModal
                isOpen={!!vendorSubsToDelete}
                onClose={() => setVendorSubsToDelete(null)}
                onConfirm={() => vendorSubsToDelete && handleDeleteVendorSubs(vendorSubsToDelete)}
                title="Delete Record"
                message="Are you sure you want to delete this vendor/sub record? This cannot be undone."
                confirmText="Delete"
            />

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
                                        <button onClick={() => setNewRelease(prev => ({ ...prev, DatesOfWaiverRelease: prev.DatesOfWaiverRelease.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-500"><X size={16} /></button>
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
                                        <button onClick={() => setNewRelease(prev => ({ ...prev, amountsOfUnpaidProgressPayment: prev.amountsOfUnpaidProgressPayment.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-500"><X size={16} /></button>
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
                                        <button onClick={() => setNewRelease(prev => ({ ...prev, receivedProgressPayments: prev.receivedProgressPayments.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-500"><X size={16} /></button>
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

            {/* ──── 20 Day Prelim: Delete Confirm ──── */}
            <ConfirmModal
                isOpen={prelimDocToDelete !== null}
                onClose={() => setPrelimDocToDelete(null)}
                onConfirm={() => prelimDocToDelete && handleDeletePrelimDoc(prelimDocToDelete)}
                title="Remove 20 Day Prelim"
                message="Are you sure you want to remove this prelim document? This action cannot be undone."
                confirmText="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={potholeLogToDelete !== null}
                onClose={() => setPotholeLogToDelete(null)}
                onConfirm={confirmDeletePotholeLog}
                title="Delete Pothole Log"
                message="Are you sure you want to delete this pothole log? This action cannot be undone."
                confirmText="Delete"
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
                                        <X size={14} />
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
                                            <div className="relative w-16 h-16 rounded-lg overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                src={file.thumbnailUrl || file.url}
                                                alt={file.name}
                                                className="object-cover rounded-lg border border-slate-200 w-full h-full"
                                            /></div>
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

            {/* Billing Ticket Sent Date Modal */}
            <Modal
                isOpen={billingTicketSentDateOpen}
                onClose={() => setBillingTicketSentDateOpen(false)}
                title="Mark as Sent"
                maxWidth="sm"
            >
                <div className="p-4">
                    <p className="text-xs text-slate-500 mb-3">Set the date this billing ticket was sent.</p>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sent Date</label>
                    <input
                        type="date"
                        value={billingTicketSentDateValue}
                        onChange={(e) => setBillingTicketSentDateValue(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <div className="flex items-center justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => setBillingTicketSentDateOpen(false)}>Cancel</Button>
                        <Button
                            size="sm"
                            onClick={handleConfirmBillingTicketSentDate}
                            disabled={billingTicketSentDateSaving}
                            className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white"
                        >
                            {billingTicketSentDateSaving ? 'Saving...' : 'Confirm'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={deleteMsgId !== null}
                onClose={() => setDeleteMsgId(null)}
                onConfirm={confirmDeleteMessage}
                title="Delete Message"
                message="Are you sure you want to delete this message? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
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
