'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, RefreshCw, Plus, Trash2, ChevronsUp, ChevronsDown, Copy, FileText, LayoutTemplate, ArrowLeft, Download, ChevronDown, ChevronRight, FileSpreadsheet, Check, Pencil, X, FilePlus, Upload, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Link, Image, Eraser } from 'lucide-react';
import { Header, Loading, Button, AddButton, ConfirmModal, SkeletonEstimateHeader, SkeletonAccordion, FullEstimateSkeleton, Modal, LetterPageEditor, MyDropDown, MyTemplate, MyProposal, ClientModal, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';
import 'react-quill-new/dist/quill.snow.css';
import dynamic from 'next/dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import {
    EstimateHeaderCard,
    AccordionSection,
    AddItemModal,
    LaborCalculationModal,
    TemplateSelector,
    EstimateDetailsModal,
    EstimateLineItemsCard,
    EstimateDocsCard
} from './components';
import {
    getLaborBreakdown,
    getFringeRate,
    calculateLaborTotal,
    calculateEquipmentTotal,
    calculateMaterialTotal,
    calculateSimpleTotal,
    calculateOverheadTotal,
    getSectionColor,
    parseNum,
    type LaborBreakdown,
    type FringeConstant
} from '@/lib/estimateCalculations';

const DRAFT_KEY_PREFIX = 'estimate_draft_';

// Types
interface Template {
    _id: string;
    title: string;
    content?: string;
    pages?: { content: string }[];
    coverImage?: string;
    services?: string[];
}

interface Estimate {
    _id: string;
    estimate?: string;
    date?: string;
    customerName?: string;
    customerId?: string;
    contactName?: string;
    contactId?: string;
    contactEmail?: string;
    contactPhone?: string;
    jobAddress?: string;
    projectName?: string; // Added field
    proposalNo?: string;
    versionNumber?: number;
    bidMarkUp?: string | number;
    status?: string;
    fringe?: string;

    services?: string[];
    proposalWriter?: string | string[];
    certifiedPayroll?: string;
    prevailingWage?: boolean;
    oldOrNew?: string;
    labor?: LineItem[];

    equipment?: LineItem[];
    material?: LineItem[];
    tools?: LineItem[];
    overhead?: LineItem[];
    subcontractor?: LineItem[];
    disposal?: LineItem[];
    miscellaneous?: LineItem[];
    proposals?: Array<{
        _id?: string;
        templateId: string;
        templateVersion?: number;
        generatedAt: Date | string;
        pdfUrl?: string;
        htmlContent: string;
        customPages?: { content: string }[];
        services?: string[];
    }>;
    [key: string]: unknown;
}

interface LineItem {
    _id?: string;
    estimateId?: string;
    total?: number;
    [key: string]: unknown;
}

interface SectionConfig {
    id: string;
    title: string;
    key: string;
    headers: string[];
    fields: string[];
    formFields?: string[];
    formHeaders?: string[];
    editableFields: string[];
    color: string;
    items: LineItem[];
}

interface VersionEntry {
    _id: string;
    estimate?: string;
    proposalNo?: string;
    versionNumber?: number;
    date?: string;
    totalAmount?: number;
    status?: string;
    isChangeOrder?: boolean;
    parentVersionId?: string;
    createdAt?: string;
}

// Section configurations
const baseSectionConfigs = [
    {
        id: 'Labor', title: 'Labor', key: 'labor',
        headers: ['Labor', 'Classification', 'Sub Classification', 'Base Pay', 'Quantity', 'Days', 'OT PD', 'W. Comp', 'Payroll Tax', 'Total'],
        fields: ['labor', 'classification', 'subClassification', 'basePay', 'quantity', 'days', 'otPd', 'wCompPercent', 'payrollTaxesPercent', 'total'],
        formFields: ['classification', 'subClassification', 'fringe', 'basePay', 'quantity', 'days', 'otPd', 'wCompPercent', 'payrollTaxesPercent'],
        formHeaders: ['Classification', 'Sub Classification', 'Fringe', 'Base Pay', 'Quantity', 'Days', 'OT PD', 'W. Comp %', 'Payroll Tax %'],
        editableFields: ['labor', 'classification', 'subClassification', 'basePay', 'quantity', 'days', 'otPd', 'wCompPercent', 'payrollTaxesPercent']
    },
    {
        id: 'Equipment', title: 'Equipment', key: 'equipment',
        headers: ['Equipment / Machine', 'Classification', 'Sub Classification', 'Supplier', 'Qty', 'Times', 'UOM', 'Daily Cost', 'Weekly Cost', 'Monthly Cost', 'Fuel', 'Del & Pick', 'Total'],
        fields: ['equipmentMachine', 'classification', 'subClassification', 'supplier', 'quantity', 'times', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost', 'deliveryPickup', 'total'],
        editableFields: ['equipmentMachine', 'classification', 'subClassification', 'supplier', 'quantity', 'times', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost', 'deliveryPickup']
    },
    {
        id: 'Material', title: 'Material', key: 'material',
        headers: ['Material', 'Classification', 'Sub Classification', 'Supplier', 'Qty', 'UOM', 'Cost', 'Taxes', 'Del & Pick', 'Total'],
        fields: ['material', 'classification', 'subClassification', 'supplier', 'quantity', 'uom', 'cost', 'taxes', 'deliveryPickup', 'total'],
        editableFields: ['material', 'classification', 'subClassification', 'supplier', 'quantity', 'uom', 'cost', 'taxes', 'deliveryPickup']
    },
    {
        id: 'Tools', title: 'Tools', key: 'tools',
        headers: ['Tool', 'Classification', 'Sub Classification', 'UOM', 'Supplier', 'Cost', 'Quantity', 'Taxes', 'Total'],
        fields: ['tool', 'classification', 'subClassification', 'uom', 'supplier', 'cost', 'quantity', 'taxes', 'total'],
        editableFields: ['tool', 'classification', 'subClassification', 'uom', 'supplier', 'cost', 'quantity', 'taxes']
    },
    {
        id: 'Overhead', title: 'Overhead', key: 'overhead',
        headers: ['Overhead', 'Classification', 'Sub Classification', 'Days', 'Daily Rate', 'Total'],
        fields: ['overhead', 'classification', 'subClassification', 'days', 'dailyRate', 'total'],
        formFields: ['overhead', 'classification', 'subClassification', 'days', 'dailyRate'],
        formHeaders: ['Overhead', 'Classification', 'Sub Classification', 'Days', 'Daily Rate'],
        editableFields: ['overhead', 'classification', 'subClassification', 'days', 'dailyRate']
    },
    {
        id: 'Subcontractor', title: 'Subcontractor', key: 'subcontractor',
        headers: ['Classification', 'Sub Classification', 'Contractor', 'Qty', 'UOM', 'Cost', 'Total'],
        fields: ['classification', 'subClassification', 'subcontractor', 'quantity', 'uom', 'cost', 'total'],
        formFields: ['classification', 'subClassification', 'subcontractor', 'quantity', 'uom', 'cost'],
        formHeaders: ['Classification', 'Sub Classification', 'Contractor', 'Qty', 'UOM', 'Cost'],
        editableFields: ['classification', 'subClassification', 'subcontractor', 'quantity', 'uom', 'cost']
    },
    {
        id: 'Disposal', title: 'Disposal', key: 'disposal',
        headers: ['Disposal And Haul OFF', 'Classification', 'Sub Classification', 'UOM', 'Quantity', 'Cost', 'Total'],
        fields: ['disposalAndHaulOff', 'classification', 'subClassification', 'uom', 'quantity', 'cost', 'total'],
        formFields: ['disposalAndHaulOff', 'classification', 'subClassification', 'uom', 'quantity', 'cost'],
        formHeaders: ['Disposal And Haul OFF', 'Classification', 'Sub Classification', 'UOM', 'Quantity', 'Cost'],
        editableFields: ['disposalAndHaulOff', 'classification', 'subClassification', 'uom', 'quantity', 'cost']
    },
    {
        id: 'Miscellaneous', title: 'Miscellaneous', key: 'miscellaneous',
        headers: ['Item', 'Classification', 'Quantity', 'UOM', 'Cost', 'Total'],
        fields: ['item', 'classification', 'quantity', 'uom', 'cost', 'total'],
        formFields: ['item', 'classification', 'uom', 'cost'],
        formHeaders: ['Item', 'Classification', 'UOM', 'Cost'],
        editableFields: ['item', 'classification', 'quantity', 'uom', 'cost']
    }
];

export default function EstimateViewPage() {
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;
    const { toasts, success, error: toastError, removeToast } = useToast();

    // State
    // State
    const [estimate, setEstimate] = useState<Estimate | null>(null);


    // Proposal State
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [viewingProposalId, setViewingProposalId] = useState<string | null>(null);
    const lastPreviewRequestTime = useRef<number>(0);
    const proposalRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quillRefs = useRef<any[]>([]);
    
    // Template Editing State
    const [editorPages, setEditorPages] = useState<{ content: string }[]>([{ content: '' }]);

    // Insert variable into Quill editor
    const insertVariable = (variableName: string) => {
        // Try to find a focused editor
        for (const ref of quillRefs.current) {
            if (ref) {
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const editor = (ref as any).getEditor();
                const range = editor.getSelection();
                if (range) {
                    editor.insertText(range.index, `{{${variableName}}} `);
                    editor.setSelection(range.index + variableName.length + 5);
                    return;
                }
            }
        }
        // Fallback: insert into first page
        if (quillRefs.current[0]) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const editor = (quillRefs.current[0] as any).getEditor();
            const length = editor.getLength();
            editor.insertText(length - 1, `{{${variableName}}} `);
        }
    };
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [generatingProposal, setGeneratingProposal] = useState(false);
    const [formData, setFormData] = useState<Estimate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [chartAnimate, setChartAnimate] = useState(false);
    const [sectionOrder, setSectionOrder] = useState<string[]>([]);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    
    // Confirmation States
    const [cloneConfirmOpen, setCloneConfirmOpen] = useState<{ id?: string } | null>(null);
    const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
    const [changeOrderConfirmOpen, setChangeOrderConfirmOpen] = useState<{ id: string } | null>(null);
    
    // Visibility State
    const [visibleSections, setVisibleSections] = useState({
        estimateSummary: true,
        estimateDocs: false,
        lineItems: true,
        proposal: true
    });
    const [showSectionMenu, setShowSectionMenu] = useState(false);



    // Template Matching Utility
    const findBestTemplate = (selectedServices: string[], allTemplates: Template[]) => {
        if (!selectedServices || selectedServices.length === 0) {
            return allTemplates.find(t => t._id === 'empty') || null;
        }

        // 1. Exact Match (Exact same set of services)
        const exactMatch = allTemplates.find(t => {
            const ts = t.services || [];
            return ts.length === selectedServices.length && 
                   ts.every(s => selectedServices.includes(s)) &&
                   selectedServices.every(s => ts.includes(s));
        });
        if (exactMatch) return exactMatch;

        // 2. Best Subset Match (Template services are a subset of selected services)
        // This find templates that are "contained" within our selection, sorted by highest coverage
        const subsetMatches = allTemplates
            .filter(t => (t.services || []).length > 0 && (t.services || []).every(s => selectedServices.includes(s)))
            .sort((a, b) => (b.services?.length || 0) - (a.services?.length || 0));
        if (subsetMatches.length > 0) return subsetMatches[0];

        // 3. Best Overlap Match (Any overlapping services)
        const overlapMatches = allTemplates
            .map(t => {
                const overlap = (t.services || []).filter(s => selectedServices.includes(s)).length;
                return { template: t, overlap };
            })
            .filter(m => m.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap);
        if (overlapMatches.length > 0) return overlapMatches[0].template;

        // 4. Default to Blank Template
        return allTemplates.find(t => t._id === 'empty') || null;
    };

    const handleDownloadPdf = async () => {
        setIsDownloadingPdf(true);
        try {
            // First ensure we have the latest preview HTML generated from current state
            const generatedHtml = await handlePreview(false);
            
            // Get the HTML content for PDF
            const content = (generatedHtml || previewHtml || '');

            if (!content.trim()) {
                toastError('No content to generate PDF');
                return;
            }

            // Call the server-side PDF generation API
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html: content,

                    filename: `Proposal-${estimate?.proposalNo || 'Draft'}.pdf`,
                    coverImage: templates.find(t => t._id === selectedTemplateId)?.coverImage,
                    coverData: {
                        proposalNo: formData?.proposalNo || estimate?.proposalNo,
                        projectName: formData?.projectName || estimate?.projectName,
                        jobAddress: formData?.jobAddress || estimate?.jobAddress,
                        services: (formData?.services || estimate?.services || []).join(' & <br/>'),
                        customerName: formData?.customerName || estimate?.customerName
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate PDF');
            }

            // Get the PDF blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Proposal-${estimate?.proposalNo || 'Draft'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            success('PDF downloaded successfully!');
        } catch (err) {
            console.error('PDF Generation failed:', err);
            toastError('Failed to generate PDF');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    // Catalogs
    const [laborCatalog, setLaborCatalog] = useState<LineItem[]>([]);
    const [equipmentCatalog, setEquipmentCatalog] = useState<LineItem[]>([]);
    const [materialCatalog, setMaterialCatalog] = useState<LineItem[]>([]);
    const [overheadCatalog, setOverheadCatalog] = useState<LineItem[]>([]);
    const [disposalCatalog, setDisposalCatalog] = useState<LineItem[]>([]);
    const [subcontractorCatalog, setSubcontractorCatalog] = useState<LineItem[]>([]);
    const [miscellaneousCatalog, setMiscellaneousCatalog] = useState<LineItem[]>([]);
    const [toolsCatalog, setToolsCatalog] = useState<LineItem[]>([]);
    const [fringeConstants, setFringeConstants] = useState<FringeConstant[]>([]);
    const [statusOptions, setStatusOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [serviceOptions, setServiceOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [fringeOptions, setFringeOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [planningOptions, setPlanningOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [certifiedPayrollOptions, setCertifiedPayrollOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [employeesData, setEmployeesData] = useState<any[]>([]); // Full employee data for signature/position lookup
    const [clientOptions, setClientOptions] = useState<{ id: string; label: string; value: string }[]>([]);
    const [contactOptions, setContactOptions] = useState<{ id: string; label: string; value: string; email?: string; phone?: string }[]>([]);
    const [addressOptions, setAddressOptions] = useState<{ id: string; label: string; value: string }[]>([]);
    const [catalogsLoaded, setCatalogsLoaded] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Load visibility settings from Employee record
    useEffect(() => {
        if (employeesData.length > 0 && !settingsLoaded) {
            try {
                const user = JSON.parse(localStorage.getItem('devco_user') || '{}');
                const userEmail = user.email;
                if (userEmail) {
                     const emp = employeesData.find((e: any) => e._id === userEmail || e.email === userEmail);
                     // If settings exist, apply them. If not, we stick with defaults.
                     if (emp && Array.isArray(emp.estimateSettings)) {
                             setVisibleSections({
                                 estimateSummary: emp.estimateSettings.includes('Estimate Summary'),
                                 estimateDocs: emp.estimateSettings.includes('Job Docs'),
                                 lineItems: emp.estimateSettings.includes('Line Items'),
                                 proposal: emp.estimateSettings.includes('Proposal')
                             });
                     }
                }
            } catch (e) {
                console.error('Error loading settings', e);
            } finally {
                setSettingsLoaded(true);
            }
        }
    }, [employeesData]);

    // Save visibility settings to Backend
    useEffect(() => {
        if (!settingsLoaded) return;

        const timeoutId = setTimeout(async () => {
             const user = JSON.parse(localStorage.getItem('devco_user') || '{}');
             const userEmail = user.email;
             if (!userEmail) return;

             const settings = [];
             if (visibleSections.estimateSummary) settings.push('Estimate Summary');
             if (visibleSections.estimateDocs) settings.push('Job Docs');
             if (visibleSections.lineItems) settings.push('Line Items');
             if (visibleSections.proposal) settings.push('Proposal');

             try {
                 await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateEmployee',
                        payload: {
                            id: userEmail,
                            item: { estimateSettings: settings }
                        }
                    })
                 });
             } catch (err) {
                 console.error('Failed to save settings', err);
             }
        }, 1000); // 1s debounce

        return () => clearTimeout(timeoutId);
    }, [visibleSections, settingsLoaded]);


    const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);

    // Modals
    const [activeSection, setActiveSection] = useState<SectionConfig | null>(null);
    const [explanationItem, setExplanationItem] = useState<LineItem | null>(null);
    const [breakdownData, setBreakdownData] = useState<LaborBreakdown | null>(null);

    const [itemToDelete, setItemToDelete] = useState<{ section: SectionConfig; item: LineItem } | null>(null);
    
    // Template Editing State
    const [editorContent, setEditorContent] = useState('');
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [newTemplateTitle, setNewTemplateTitle] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);

    // Confirmation State for Version Delete
    const [versionToDelete, setVersionToDelete] = useState<{ id: string, number: number } | null>(null);
    const [saveType, setSaveType] = useState<'update' | 'create'>('update');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [proposalServicesOpen, setProposalServicesOpen] = useState(false);
    const [isAddingProposalService, setIsAddingProposalService] = useState(false);
    const [hasCustomProposal, setHasCustomProposal] = useState(false); // Track if proposal has custom edits
    
    // Client Modal State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');

    const handleCreateTemplate = () => {
        setSaveType('create');
        const currentTitle = templates.find(t => t._id === selectedTemplateId)?.title;
        setNewTemplateTitle(currentTitle ? `${currentTitle} (Copy)` : 'New Template');
        setShowSaveTemplateModal(true);
    };

    // API helpers
    const apiCall = async (action: string, payload: Record<string, unknown> = {}) => {
        const res = await fetch('/api/webhook/devcoBackend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        return res.json();
    };

    // Helper: Calculate sections (Totals only, no sort)
    const calculateSections = useCallback((est: Estimate, fringes: FringeConstant[]) => {
        return baseSectionConfigs.map(config => {
            const items = (est[config.key] as LineItem[] || []).map(item => {
                let total = item.total;
                // Always recalculate totals to ensure UI consistency
                switch (config.id) {
                    case 'Labor':
                        total = calculateLaborTotal(item, fringes);
                        break;
                    case 'Equipment':
                        total = calculateEquipmentTotal(item);
                        break;
                    case 'Material':
                        total = calculateMaterialTotal(item);
                        break;
                    case 'Overhead':
                        total = calculateOverheadTotal(item);
                        break;
                    default:
                        total = calculateSimpleTotal(item);
                }

                if (config.id === 'Labor') {
                    return {
                        ...item,
                        labor: item.labor || `${item.classification || ''}-${item.fringe || ''}`,
                        total
                    };
                }
                return { ...item, total };
            });

            return {
                ...config,
                color: getSectionColor(config.id, fringes),
                items
            };
        });
    }, []);

    // Load estimate
    const loadEstimate = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            let result;
            if (slug.includes('-V')) {
                result = await apiCall('getEstimateBySlug', { slug });
            } else {
                // Try fetching by estimate number first (handles links without version from dashboard)
                const propResult = await apiCall('getEstimatesByProposal', { estimateNumber: slug });
                if (propResult.success && Array.isArray(propResult.result) && propResult.result.length > 0) {
                     // Pick latest version
                     const sorted = propResult.result.sort((a: any, b: any) => (b.versionNumber || 0) - (a.versionNumber || 0));
                     result = { success: true, result: sorted[0] };
                } else {
                     // Fallback to ID lookup
                     result = await apiCall('getEstimateById', { id: slug });
                }
            }

            if (result.success && result.result) {
                const data = result.result;
                if (data.bidMarkUp) {
                    data.bidMarkUp = String(data.bidMarkUp).replace(/[^0-9.]/g, '');
                }
                setEstimate(data);
                setFormData(data);
                setUnsavedChanges(false);

                if (data.estimate) {
                    loadVersionHistory(data.estimate);
                }

                // Default to the latest proposal version if available
                if (data.proposals && data.proposals.length > 0) {
                    const sorted = [...data.proposals].sort((a: any, b: any) => 
                        new Date(b.generatedAt || b.createdAt || 0).getTime() - 
                        new Date(a.generatedAt || a.createdAt || 0).getTime()
                    );
                    const latest = sorted[0];
                    const latestId = latest._id || (latest.generatedAt ? String(latest.generatedAt) : null);
                    if (latestId) {
                        setViewingProposalId(latestId);
                        // Ensure we have the latest content loaded
                        if (latest.htmlContent) setPreviewHtml(latest.htmlContent);
                    }
                }

                // Check for local draft using the fetched ID
                /* 
                // TEMPORARILY DISABLED TO FIX STALE DATA ISSUES
                const draftKey = `${DRAFT_KEY_PREFIX}${data._id}`;
                const savedDraft = localStorage.getItem(draftKey);
                if (savedDraft) {
                    try {
                        const draftData = JSON.parse(savedDraft);
                        if (draftData.estimate._id === data._id) {
                            setEstimate(draftData.estimate);
                            setFormData(draftData.formData);
                            setUnsavedChanges(true);
                            if (toastShownRef.current !== data._id) {
                                toastShownRef.current = data._id;
                                setTimeout(() => {
                                    success('Restored unsaved changes from this browser');
                                }, 500);
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse draft', e);
                    }
                }
                */
            } else {
                toastError('Estimate not found');
            }
        } catch (err) {
            console.error('Error loading estimate:', err);
            toastError('Failed to load estimate');
        }
        if (!silent) setLoading(false);
    }, [slug, toastError, success]);

    // Load catalogs - single batch request
    const loadCatalogs = useCallback(async () => {
        try {
            const result = await apiCall('getAllCatalogueItems');
            if (result.success && result.result) {
                const { equipment, labor, material, overhead, subcontractor, disposal, miscellaneous, tools, constant } = result.result;
                setEquipmentCatalog(equipment || []);
                setLaborCatalog(labor || []);
                setMaterialCatalog(material || []);
                setOverheadCatalog(overhead || []);
                setSubcontractorCatalog(subcontractor || []);
                setDisposalCatalog(disposal || []);
                setMiscellaneousCatalog(miscellaneous || []);
                setToolsCatalog(tools || []);
                setMiscellaneousCatalog(miscellaneous || []);
                setFringeConstants((constant || []) as unknown as FringeConstant[]);

                // Process Status Options
                const statuses = (constant || [])
                    .filter((c: any) => {
                        const type = (c.type || c.category || '').toLowerCase();
                        return type === 'estimate status';
                    })
                    .map((c: any) => ({
                        id: c._id,
                        label: c.description || c.value,
                        value: c.description || c.value,
                        color: c.color
                    }))
                    .sort((a: any, b: any) => a.label.localeCompare(b.label));
                setStatusOptions(statuses);

                // Process Service Options
                const services = (constant || [])
                    .filter((c: any) => {
                        const type = (c.type || c.category || '').toLowerCase();
                        return type === 'services' || type === 'service';
                    })
                    .map((c: any) => ({
                        id: c._id,
                        label: (c.description || c.value || 'Unnamed Service').trim(),
                        value: (c.description || c.value || '').trim(),
                        color: c.color
                    }))
                    .sort((a: any, b: any) => a.label.localeCompare(b.label));
                setServiceOptions(services);

                // Process Fringe Options
                const fringes = (constant || [])
                    .filter((c: any) => {
                        const type = (c.type || c.category || '').toLowerCase();
                        return type === 'fringe';
                    })
                    .map((c: any) => ({
                        id: c._id,
                        label: c.description || c.value,
                        value: (c.description || c.value || '').trim(), // Ensure trim
                        color: c.color
                    }))
                    .sort((a: any, b: any) => a.label.localeCompare(b.label));
                setFringeOptions(fringes);

                // Process Certified Payroll Options
                const certifiedPayroll = (constant || [])
                    .filter((c: any) => {
                        const type = (c.type || c.category || '').toLowerCase();
                        return type === 'certified payroll';
                    })
                    .map((c: any) => ({
                        id: c._id,
                        label: c.description || c.value,
                        value: (c.description || c.value || '').trim(),
                        color: c.color
                    }))
                    .sort((a: any, b: any) => a.label.localeCompare(b.label));
                setCertifiedPayrollOptions(certifiedPayroll);

                // Process Planning Options
                const planning = (constant || [])
                    .filter((c: any) => {
                        const type = (c.type || c.category || '').toLowerCase();
                        return type === 'planning';
                    })
                    .map((c: any) => ({
                        id: c._id,
                        label: c.description || c.value,
                        value: (c.description || c.value || '').trim(),
                        color: c.color
                    }))
                    .sort((a: any, b: any) => a.label.localeCompare(b.label));
                setPlanningOptions(planning);

                // Fetch Employees for Proposal Writer
                const employeeRes = await apiCall('getEmployees');
                if (employeeRes.success && employeeRes.result) {
                    // Store full employee data for signature lookup
                    setEmployeesData(employeeRes.result);
                    
                    const employees = employeeRes.result
                        .filter((emp: any) => {
                            if (emp.status === 'inactive') return false;
                            const email = (emp.email || emp._id || '').toLowerCase();
                            const allowed = [
                                'ns@devco-inc.com',
                                'nr@devco-inc.com',
                                'cd@devco-inc.com',
                                'sean@devco-inc.com',
                                'dt@devco-inc.com'
                            ];
                            return allowed.includes(email);
                        })
                        .map((emp: any) => ({
                            id: emp._id,
                            label: `${emp.firstName} ${emp.lastName}`,
                            value: emp._id,
                            profilePicture: emp.profilePicture
                        }))
                        .sort((a: any, b: any) => a.label.localeCompare(b.label));

                    setEmployeeOptions(employees);
                }

                // Fetch Clients
                const clientRes = await apiCall('getClients');
                if (clientRes.success && clientRes.result) {
                    const clients = clientRes.result.map((c: any) => ({
                        id: c._id || c.recordId,
                        label: c.name,
                        value: c._id || c.recordId
                    })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                    setClientOptions(clients);

                    // If we have a customerId but no customerName in formData, try to resolve it now
                    if (formData?.customerId && !formData.customerName) {
                        const client = clients.find((c: any) => c.value === formData.customerId);
                        if (client) {
                            setFormData(prev => prev ? { ...prev, customerName: client.label } : null);
                        }
                    }
                }


            }
        } catch (err) {
            console.error('Error loading catalogs:', err);
            toastError('Failed to load catalogs');
        }
        setCatalogsLoaded(true);
    }, []);

    // Load version history
    const loadVersionHistory = async (estimateNumber: string) => {
        try {
            const result = await apiCall('getEstimatesByProposal', { estimateNumber });
            if (result.success && result.result) {
                // Sort by version number desc, then by date/id desc for stability
                const sorted = result.result.sort((a: VersionEntry, b: VersionEntry) => {
                    if ((b.versionNumber || 0) !== (a.versionNumber || 0)) {
                        return (b.versionNumber || 0) - (a.versionNumber || 0);
                    }
                    // Same version number (e.g. COs) -> sort by ID or createdAt
                    return b._id.localeCompare(a._id);
                });
                setVersionHistory(sorted);
            }
        } catch (err) {
            console.error('Error loading version history:', err);
        }
    };

    // Load initial data
    useEffect(() => {
        if (slug) {
            loadEstimate();
            loadCatalogs();
        }
        // Fetch templates
        apiCall('getTemplates').then(res => {
            if (res.success && res.result) {
                setTemplates(res.result);
                // Don't auto-select - let user choose
            }
        });
    }, [slug, loadEstimate, loadCatalogs]);
    
    // Synchronize client options (contacts/addresses) when customer changes
    useEffect(() => {
        const syncClientOptions = async () => {
            const cid = formData?.customerId;
            if (!cid) {
                setContactOptions([]);
                setAddressOptions([]);
                return;
            }
            try {
                const res = await apiCall('getClientById', { id: cid });
                if (res.success && res.result) {
                    const client = res.result;
                    
                    // Update Contacts
                    const contacts = (client.contacts || []).map((c: any) => ({
                        id: c.name,
                        label: c.name,
                        value: c.name,
                        email: c.email,
                        phone: c.phone
                    }));
                    if (client.contactFullName) {
                        if (!contacts.find((c: any) => c.label === client.contactFullName)) {
                            contacts.unshift({
                                id: client.contactFullName,
                                label: client.contactFullName,
                                value: client.contactFullName,
                                email: client.email || client.contactEmail,
                                phone: client.phone || client.contactPhone
                            });
                        }
                    }
                    setContactOptions(contacts.sort((a: any, b: any) => a.label.localeCompare(b.label)));

                    // Update Addresses - Exclude Primary/Business addresses
                    const addresses = [...(client.addresses || []), ...(client.address || [])]
                        .filter((a: any) => typeof a === 'object' ? !a.primary : true) // Filter out primary if object
                        .map((a: any) => {
                            const addrStr = typeof a === 'string' ? a : (a.fullAddress || a.address || a.street || JSON.stringify(a));
                            return {
                                id: addrStr,
                                label: addrStr,
                                value: addrStr
                            };
                        })
                        .filter(a => a.value !== client.businessAddress); // Also filter out business address string match
                    
                    setAddressOptions(addresses.sort((a: any, b: any) => a.label.localeCompare(b.label)));
                }
            } catch (err) {
                console.error('Error syncing client options:', err);
            }
        };

        syncClientOptions();
    }, [formData?.customerId]);

    // Resolve Customer Name if missing
    useEffect(() => {
        if (formData?.customerId && !formData.customerName && clientOptions.length > 0) {
            const client = clientOptions.find(c => c.value === formData.customerId);
            if (client) {
                setFormData(prev => prev ? { ...prev, customerName: client.label } : null);
            }
        }
    }, [formData?.customerId, formData?.customerName, clientOptions]);



    // Initial Sort & Expand Logic
    useEffect(() => {
        if (catalogsLoaded && estimate && !initialLoadComplete) {
            // 1. Calculate sections
            const calculated = calculateSections(estimate, fringeConstants);

            // 2. Determine sort order (original order)
            setSectionOrder(calculated.map(s => s.id));

            // 3. Determine open sections (if items > 0, open it)
            const newOpen: Record<string, boolean> = {};
            calculated.forEach(s => {
                if (s.items.length > 0) newOpen[s.id] = true;
            });
            setOpenSections(newOpen);

            setInitialLoadComplete(true);
        }
    }, [catalogsLoaded, estimate, initialLoadComplete, fringeConstants, calculateSections]);


    // Chart animation trigger
    useEffect(() => {
        if (estimate) {
            setChartAnimate(false);
            const timer = setTimeout(() => setChartAnimate(true), 500);
            return () => clearTimeout(timer);
        }
    }, [estimate]);



    // Memoized Sections for Render (Uses sectionOrder for sorting)
    const sections: SectionConfig[] = useMemo(() => {
        if (!estimate || !catalogsLoaded) return [];

        const calculated = calculateSections(estimate, fringeConstants);

        // Sort based on saved order
        return calculated.sort((a, b) => {
            const idxA = sectionOrder.indexOf(a.id);
            const idxB = sectionOrder.indexOf(b.id);
            // If not found in order (e.g. new session), push to end or use default
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }, [estimate, fringeConstants, catalogsLoaded, sectionOrder, calculateSections]);

    // Chart data (always reflects current totals)
    const chartData = useMemo(() => {
        if (!sections.length) return { slices: [], subTotal: 0, grandTotal: 0, markupPct: 0 };
        // ... same chart logic ...
        const slices = sections.map(s => ({
            id: s.id,
            label: s.title,
            value: s.items.reduce((sum, i) => sum + (i.total || 0), 0),
            color: s.color
        }));

        const subTotal = slices.reduce((sum, s) => sum + s.value, 0);
        const markupPct = parseNum(formData?.bidMarkUp || estimate?.bidMarkUp);
        const grandTotal = subTotal * (1 + markupPct / 100);

        return { slices, subTotal, grandTotal, markupPct };
    }, [sections, formData?.bidMarkUp, estimate?.bidMarkUp]);

    // Auto-save logic (debounced 800ms)
    useEffect(() => {
        if (!unsavedChanges || !estimate || !formData || saving) return;

        const timer = setTimeout(() => {
            // Skip auto-save if user is currently editing an input
            if (document.body.dataset.inputFocused === 'true') return;
            
            handleGlobalSave({ silent: true });
        }, 800);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unsavedChanges, estimate, formData, chartData]);

    // Live update current version total in history
    useEffect(() => {
        if (!estimate?._id || !chartData) return;

        setVersionHistory(prev => {
            const index = prev.findIndex(v => v._id === estimate._id);
            if (index === -1) return prev;

            // Only update if changed to avoid loops
            // Use a small epsilon for float comparison or exact match if preferred
            if (Math.abs((prev[index].totalAmount || 0) - chartData.grandTotal) < 0.01 && 
                prev[index].status === formData?.status) return prev;

            const newHistory = [...prev];
            newHistory[index] = {
                ...newHistory[index],
                totalAmount: chartData.grandTotal,
                status: formData?.status
            };
            return newHistory;
        });
    }, [chartData.grandTotal, estimate?._id, formData?.status]);

    // Auto-refresh preview when SERVICES change (debounce 500ms)
    // Only regenerate if services change - preserve saved proposal otherwise
    // Auto-refresh preview when data changes (debounce 800ms)
    useEffect(() => {
        // Run if we have a template selected and not in manual edit mode
        if (!selectedTemplateId || isEditingTemplate || generatingProposal || saving || isSavingTemplate || !estimate) {
            return;
        }
        
        // Debounce the preview generation to handle rapid typing
        const timer = setTimeout(() => {
            handlePreview(true); // silent refresh
        }, 800);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, chartData, selectedTemplateId, isEditingTemplate, viewingProposalId, estimate?.proposals, saving, isSavingTemplate]);


    // Unified Template Matching & Versioning Effect
    // Triggers when services change (debounced to simulate "blur/focus change")
    useEffect(() => {
        if (!initialLoadComplete || !templates.length || isEditingTemplate || generatingProposal || saving || isSavingTemplate) return;
        
        const services = formData?.services || [];
        
        const timer = setTimeout(() => {
            handleAutoTemplateMatch(services);
        }, 1500);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData?.services, templates, initialLoadComplete]);

    const handleAutoTemplateMatch = async (services: string[]) => {
        if (!estimate) return;

        // Find Best Template based on the Hierarchy (Exact -> Subset -> Overlap -> Blank)
        const bestTemplate = findBestTemplate(services, templates);
        const newTid = bestTemplate?._id || 'empty';

        // Only proceed if the template recommendation actually changes
        if (newTid === selectedTemplateId) return;

        console.log(`Matching template ${newTid} for services: ${services.join(', ')}`);
        
        // Before changing, check if we already have versions for the NEW template
        const existingVersions = (estimate?.proposals || []).filter((p: any) => p.templateId === newTid);
        
        setSelectedTemplateId(newTid);

        if (existingVersions.length > 0) {
            // Pick the latest version
            const sorted = [...existingVersions].sort((a: any, b: any) => 
                new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
            );
            const latest = sorted[0];
            const latestId = latest._id || String(latest.generatedAt);
            setViewingProposalId(latestId);
            setPreviewHtml(latest.htmlContent);
            if (latest.customPages) setEditorPages(latest.customPages);
            success(`Loaded existing proposal for ${bestTemplate?.title || 'template'}`);
        } else if (newTid !== 'empty') {
            // Generate a fresh version for this new template selection from scratch
            await handleGenerateProposal(newTid);
        } else {
            // For empty template, reset viewing ID and trigger a standard preview 
            // handlePreview DOES NOT save a new version to the database.
            setViewingProposalId(null);
            handlePreview(false, 'empty');
        }
    };

    // Handlers
    // Save changes only to the current estimate's proposal (does NOT update main template)
    const handleSaveProposalChanges = async () => {
        if (!estimate) return;
        setIsSavingTemplate(true);
        // Invalidate any pending auto-prefix refreshes
        lastPreviewRequestTime.current = Date.now();

        try {
            // Generate the HTML with current editor pages content
            const pagesToSave = editorPages;
            const contentToSave = editorPages[0]?.content || '';
            
            const currentEstimate = {
                ...estimate,
                ...formData,
                ...chartData,
                labor: estimate.labor,
                equipment: estimate.equipment,
                material: estimate.material,
                tools: estimate.tools,
                overhead: estimate.overhead,
                subcontractor: estimate.subcontractor,
                disposal: estimate.disposal,
                miscellaneous: estimate.miscellaneous
            };

            // Generate proposal with the edited pages (but don't update template)
            const result = await apiCall('generateProposalFromPages', {
                templateId: selectedTemplateId,
                estimateId: estimate._id,
                pages: pagesToSave,
                estimateData: currentEstimate
            });

            if (result.success && result.result) {
                const newProposal = result.result;
                setPreviewHtml(newProposal.html);
                setHasCustomProposal(true);
                setIsEditingTemplate(false);
                
                const newId = newProposal._id || (newProposal.generatedAt ? String(newProposal.generatedAt) : null);
                if (newId) {
                    setViewingProposalId(newId);
                }

                // Update local list immediately to prevent stale refreshes
                // CRITICAL: We push to TOP so that our "latest proposal" finder sees it first!
                setEstimate(prev => {
                    if (!prev) return prev;
                    // Safely handle existing proposals array
                    const existingProposals = Array.isArray(prev.proposals) ? prev.proposals : [];
                    
                    // Filter out any temp/duplicate ID if it exists (unlikely with new ID, but safe)
                    const filtered = existingProposals.filter((p: any) => p._id !== newProposal._id);
                    
                    // Return new state with our new proposal AT THE TOP (index 0)
                    return { ...prev, proposals: [newProposal, ...filtered] };
                });
                
                // ALSO update the charts/form data to sync everything
                setFormData(currentEstimate);

                success('Proposal changes saved');
                await loadEstimate(true);
            } else {
                console.error('Save proposal error:', result.error);
                toastError(result.error || 'Failed to save proposal changes');
            }
        } catch (e) {
            console.error(e);
            toastError('Error saving proposal changes');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    // Update the main template (only when explicitly requested)
    const handleUpdateMainTemplate = async () => {
        setIsSavingTemplate(true);

        const action = saveType === 'create' ? 'addTemplate' : 'updateTemplate';
        const payload: any = {};
        
        const pagesToSave = editorPages;
        const contentToSave = editorPages[0]?.content || '';

        if (saveType === 'create') {
            payload.item = {
                title: newTemplateTitle,
                content: contentToSave,
                pages: pagesToSave,
                services: formData?.services || []
            };
        } else {
            payload.id = selectedTemplateId;
            payload.item = {
                content: contentToSave,
                pages: pagesToSave
            };
        }

        try {
            const res = await apiCall(action, payload);
            if (res.success) {
                success(saveType === 'create' ? 'Template created' : 'Main template updated');
                setShowSaveTemplateModal(false);
                setIsEditingTemplate(false);
                
                // Refresh templates
                const tRes = await apiCall('getTemplates');
                if (tRes.success) setTemplates(tRes.result);

                // If created new, select it
                if (saveType === 'create' && res.result && res.result._id) {
                    setSelectedTemplateId(res.result._id);
                    handleGenerateProposal(res.result._id);
                } else {
                    handleGenerateProposal();
                }
            } else {
                toastError(res.error || 'Failed to save template');
            }
        } catch (e) {
            console.error(e);
            toastError('Error saving template');
        } finally {
            setIsSavingTemplate(false);
        }
    };



    const handleGenerateProposal = async (explicitTemplateId?: string) => {
        const tid = explicitTemplateId || selectedTemplateId;
        if (!tid || !estimate) return;
        setGeneratingProposal(true);
        // Invalidate pending previews
        lastPreviewRequestTime.current = Date.now();
        const tidToUse = tid === 'empty' ? null : tid;

        // Extract custom variable values from the DOM
        const customVariables: Record<string, string> = {};

        // Only scrape if we are NOT switching templates (no explicit ID passed)
        if (!explicitTemplateId && proposalRef.current) {
            // Get all custom text inputs
            proposalRef.current.querySelectorAll('.custom-var-text').forEach((input, idx) => {
                customVariables[`customText_${idx}`] = (input as HTMLInputElement).value || '';
            });
            // Get all custom currency inputs
            proposalRef.current.querySelectorAll('.custom-var-currency').forEach((input, idx) => {
                customVariables[`customCurrency_${idx}`] = (input as HTMLInputElement).value || '';
            });
            // Get all custom number inputs
            proposalRef.current.querySelectorAll('.custom-var-number').forEach((input, idx) => {
                customVariables[`customNumber_${idx}`] = (input as HTMLInputElement).value || '';
            });
            // Get all line item selects
            proposalRef.current.querySelectorAll('.line-item-select').forEach((select, idx) => {
                const el = select as HTMLSelectElement;
                const selectedOption = el.options[el.selectedIndex];
                customVariables[`lineItem_${idx}`] = selectedOption?.text || '';
            });
        }

        const currentEstimate = {
            ...estimate,
            ...formData,
            ...chartData,
            labor: estimate.labor,
            equipment: estimate.equipment,
            material: estimate.material,
            tools: estimate.tools,
            overhead: estimate.overhead,
            subcontractor: estimate.subcontractor,
            disposal: estimate.disposal,
            miscellaneous: estimate.miscellaneous
        };

        const result = await apiCall('generateProposal', {
            templateId: tid,
            estimateId: estimate._id,
            customVariables,
            estimateData: currentEstimate
        });
        if (result.success && result.result) {
            const newProposal = result.result;
            setPreviewHtml(newProposal.html);
            setIsEditingTemplate(false);
            
            const newId = newProposal._id || (newProposal.generatedAt ? String(newProposal.generatedAt) : null);
            if (newId) {
                setViewingProposalId(newId);
            }

            // Update local list immediately to prevent stale refreshes
            setEstimate(prev => {
                if (!prev) return prev;
                const existingProposals = prev.proposals || [];
                // Replace or add
                const filtered = existingProposals.filter((p: any) => p._id !== newProposal._id);
                return { ...prev, proposals: [newProposal, ...filtered] };
            });

            if (!explicitTemplateId) success('Proposal generated and saved');
            loadEstimate(true);
        } else {
            toastError('Failed to generate proposal');
        }
        setGeneratingProposal(false);
    };

    // Auto-select template based on services
    useEffect(() => {
        if (!templates.length || isEditingTemplate || !formData || !estimate || viewingProposalId) return;

        const selectedServices = formData.services || [];
        
        // If no services selected, clear template and preview
        if (selectedServices.length === 0) {
            if (selectedTemplateId !== '' || previewHtml !== '') {
                setSelectedTemplateId('');
                setPreviewHtml('');
            }
            return;
        }
        
        // Match logic:
        // Find templates that have the highest number of matching services
        const matches = templates.map(t => {
            const templateSvcs = t.services || [];
            const intersection = selectedServices.filter(s => templateSvcs.includes(s));
            return { id: t._id, count: intersection.length };
        }).filter(m => m.count > 0);

        if (matches.length > 0) {
            // Sort by count descending
            matches.sort((a, b) => b.count - a.count);
            const bestMatchId = matches[0].id;
            
            if (bestMatchId !== selectedTemplateId) {
                setSelectedTemplateId(bestMatchId);
                
                // Check if we have a saved proposal for this template
                const savedProposal = estimate.proposals?.find(p => p.templateId === bestMatchId);
                
                if (savedProposal && savedProposal.htmlContent) {
                    // Use the saved proposal content
                    setPreviewHtml(savedProposal.htmlContent);
                } else {
                    // Generate new proposal for this template
                    handleGenerateProposal(bestMatchId);
                }
            }
        } else {
            // No matches at all - use empty template instead of generic empty state
            if (selectedTemplateId !== 'empty') {
                setSelectedTemplateId('empty');
                handleGenerateProposal('empty');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData?.services, templates, isEditingTemplate, viewingProposalId]);

    const handleHeaderUpdate = async (field: string, value: string | number | boolean | string[]) => {
        if (!formData) return;
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
        setUnsavedChanges(true);

        // Auto-populate logic when Customer changes
        if (field === 'customerId' && value && typeof value === 'string') {
            try {
                // Fetch Client Details (has both addresses and contacts now)
                const clientRes = await apiCall('getClientById', { id: value });
                if (clientRes.success && clientRes.result) {
                    const client = clientRes.result;

                    const primaryAddrObj = (client.addresses || []).find((a: any) => a.primary) || client.addresses?.[0];
                    const primaryAddress = primaryAddrObj ? (typeof primaryAddrObj === 'string' ? primaryAddrObj : primaryAddrObj.address) : (client.businessAddress || '');
                    
                    const primaryContact = (client.contacts || []).find((c: any) => c.primary) || client.contacts?.[0] || { name: client.contactFullName, email: client.email, phone: client.phone };

                    // Find the first non-primary address to use as default Job Address
                    const allAddresses = [...(client.addresses || []), ...(client.address || [])];
                    const firstJobSite = allAddresses.find((a: any) => {
                        const isPrimary = typeof a === 'object' && a.primary;
                        const addrStr = typeof a === 'string' ? a : (a.fullAddress || a.address || a.street);
                        const isBusiness = addrStr === client.businessAddress;
                        return !isPrimary && !isBusiness && !!addrStr;
                    });
                    
                    const defaultJobAddress = firstJobSite 
                        ? (typeof firstJobSite === 'string' ? firstJobSite : (firstJobSite.fullAddress || firstJobSite.address || firstJobSite.street))
                        : '';

                    setFormData(prev => prev ? {
                        ...prev,
                        jobAddress: defaultJobAddress,
                        contactAddress: defaultJobAddress,
                        contactName: primaryContact.name || '',
                        contactId: primaryContact.name || '',
                        contactEmail: primaryContact.email || '',
                        contactPhone: primaryContact.phone || ''
                    } : null);

                }
            } catch (error) {
                console.error('Error auto-populating client details:', error);
            }
        }
    };


    const handleServicesChange = (newServices: string[]) => {
        if (!formData) return;
        setFormData(prev => prev ? { ...prev, services: newServices } : null);
        setUnsavedChanges(true);
    };

    const handleFringeChange = (newFringe: string) => {
        if (!formData) return;
        console.log('Fringe changed to:', newFringe);
        setFormData(prev => prev ? { ...prev, fringe: newFringe } : null);
        setUnsavedChanges(true);
    };

    const handleStatusChange = (newStatus: string) => {
        if (!formData) return;
        setFormData(prev => prev ? { ...prev, status: newStatus } : null);
        setUnsavedChanges(true);
    };

    const handleItemUpdate = (section: SectionConfig, item: LineItem, field: string, value: string | number) => {
        if (!estimate) return;

        setEstimate(prev => {
            if (!prev) return null;
            const items = (prev[section.key] as LineItem[]) || [];
            const updatedItems = items.map(i => {
                if (i._id !== item._id) return i;
                const updatedItem = { ...i, [field]: value };
                // ... update logic implied in calculateSections, but we store raw values here ...
                // Actually we need to store recalculations if fields depend on it?
                // The original code did calculation here. 
                // Since calculateSections is used for render, we can just save raw values
                // UNLESS the item update depends on previous calc?
                if (section.id === 'Overhead' && field === 'days') {
                    updatedItem.hours = parseNum(value) * 8;
                }
                return updatedItem;
            });
            return { ...prev, [section.key]: updatedItems };
        });
        setUnsavedChanges(true);
    };

    const handleAddItem = async (section: SectionConfig, data: Record<string, unknown>, isManual: boolean) => {
        if (!estimate) return;
        const processedData = { ...data };
        processedData._id = 'temp_' + Date.now() + Math.random().toString(36).substr(2, 9);
        processedData.estimateId = estimate._id;
        if (section.id === 'Labor') {
            processedData.labor = `${processedData.classification || ''}-${processedData.fringe || ''}`;
            if (processedData.otPd === undefined || processedData.otPd === null) {
                processedData.otPd = 2;
            }
        }
        setEstimate(prev => {
            if (!prev) return null;
            const items = (prev[section.key] as LineItem[]) || [];
            return { ...prev, [section.key]: [...items, processedData as LineItem] };
        });
        setUnsavedChanges(true);
        // Auto-open section if closed
        if (!openSections[section.id]) {
            setOpenSections(prev => ({ ...prev, [section.id]: true }));
        }
        success('Item added (unsaved)');
    };

    const handleDeleteItem = (section: SectionConfig, item: LineItem) => {
        setItemToDelete({ section, item });
    };

    const confirmDeleteItem = () => {
        if (!itemToDelete) return;
        const { section, item } = itemToDelete;
        setEstimate(prev => {
            if (!prev) return null;
            const items = (prev[section.key] as LineItem[]) || [];
            return { ...prev, [section.key]: items.filter(i => i._id !== item._id) };
        });
        setUnsavedChanges(true);
        success('Item removed (unsaved)');
        setItemToDelete(null);
    };

    const handleExplain = (item: LineItem) => {
        const breakdown = getLaborBreakdown(item, fringeConstants);
        setBreakdownData(breakdown);
        setExplanationItem(item);
    };

    const handleGlobalSave = async (options: { silent?: boolean } = {}) => {
        if (!estimate || !formData) return;
        if (!options.silent) setSaving(true);
        try {
            const payload = {
                id: estimate._id,
                ...formData,
                fringe: formData.fringe,
                bidMarkUp: String(formData.bidMarkUp).includes('%') ? formData.bidMarkUp : `${formData.bidMarkUp}%`,
                subTotal: chartData.subTotal,
                margin: (chartData.grandTotal || 0) - (chartData.subTotal || 0),
                grandTotal: chartData.grandTotal,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                jobAddress: formData.jobAddress,

                labor: estimate.labor,
                equipment: estimate.equipment,
                material: estimate.material,
                tools: estimate.tools,
                overhead: estimate.overhead,
                subcontractor: estimate.subcontractor,
                disposal: estimate.disposal,
                miscellaneous: estimate.miscellaneous,
                prevailingWage: formData.certifiedPayroll === 'Yes' ? formData.prevailingWage : false
            };

            const result = await apiCall('updateEstimate', payload);
            if (!result.success) throw new Error(result.error || 'Save failed');

            if (!options.silent) {
                success('Estimate saved successfully');
            }
            
            setUnsavedChanges(false);

            // We no longer re-sort on save to maintain original order
            // Keep existing sectionOrder


        } catch (err) {
            console.error('Save error:', err);
            if (!options.silent) {
                toastError('Failed to save estimate');
            }
        } finally {
            if (!options.silent) setSaving(false);
        }
    };

    const handlePreview = async (forceEditMode?: boolean, explicitTemplateId?: string) => {
        const tid = explicitTemplateId || selectedTemplateId;
        if (!tid || !estimate) return;
        
        // Force save if unsaved changes exist to ensure DB consistency for preview generation
        // This fixes issues where backend might ignore overrides or rely on DB state
        if (unsavedChanges) {
            await handleGlobalSave({ silent: true });
        }

        setGeneratingProposal(true);

        // Construct current estimate state (merging unsaved changes)
        // We need to merge header form data + calculated totals + current line items
        const currentEstimate = {
            ...estimate,
            ...formData, // Overwrite with header form data (Project Name, etc.)
            ...chartData // Overwrite with calculated totals (Grand Total, etc.)
        };

        const editMode = forceEditMode !== undefined ? forceEditMode : isEditingTemplate;
        
        // Find current proposal to preserve its custom edits during preview
        // Sort by date descending to always pick the latest version if multiple exist for the template
        const sortedProposals = [...(estimate.proposals || [])].sort((a: any, b: any) => 
            new Date(b.generatedAt || b.createdAt || 0).getTime() - 
            new Date(a.generatedAt || a.createdAt || 0).getTime()
        );

        const currentProposal = viewingProposalId 
            ? sortedProposals.find((p: any) => (p._id && String(p._id) === viewingProposalId) || (p.generatedAt && String(p.generatedAt) === viewingProposalId))
            : sortedProposals.find((p: any) => p.templateId === selectedTemplateId);

        const requestTime = Date.now();
        lastPreviewRequestTime.current = requestTime;

        try {
            const result = await apiCall('previewProposal', {
                templateId: tid,
                estimateId: estimate._id,
                editMode,
                estimateData: currentEstimate,
                // CRITICAL FIX: If we are actively editing, use local editorPages state.
                // If we are just viewing, use the saved pages from the current proposal version.
                // This prevents the preview from reverting to the database version while you are typing.
                pages: isEditingTemplate ? editorPages : (currentProposal?.customPages || undefined)
            });

            // Ignore if a newer request has been started
            if (requestTime < lastPreviewRequestTime.current) {
                return null; // Return null as the result is stale
            }

            if (result.success && result.result) {
                setPreviewHtml(result.result.html);
                return result.result.html;
            } else {
                toastError('Failed to generate preview');
                return null;
            }
        } catch (error) {
            console.error('Preview generation error:', error);
            toastError('Failed to generate preview');
            return null;
        } finally {
            // Only clear generating state if this was the latest request
            if (requestTime === lastPreviewRequestTime.current) {
                setGeneratingProposal(false);
            }
        }
    };

    const handleClone = (id?: string) => {
        setCloneConfirmOpen({ id });
    };

    const confirmClone = async () => {
        if (!cloneConfirmOpen) return;
        const id = cloneConfirmOpen.id;
        setCloneConfirmOpen(null);
        setLoading(true);
        try {
            const result = await apiCall('cloneEstimate', { id: id || estimate?._id });
            if (result.success && result.result) {
                const newSlug = result.result._id; // Use ID for exact version
                router.push(`/estimates/${newSlug}`);
                success('Estimate cloned (v' + result.result.versionNumber + ')');
            } else {
                toastError('Failed to clone estimate');
                setLoading(false);
            }
        } catch (err) {
            console.error('Clone error:', err);
            toastError('Failed to clone estimate');
            setLoading(false);
        }
    };

    const handleAddChangeOrder = (id: string) => {
        setChangeOrderConfirmOpen({ id });
    };

    const confirmAddChangeOrder = async () => {
        if (!changeOrderConfirmOpen) return;
        const id = changeOrderConfirmOpen.id;
        setChangeOrderConfirmOpen(null);
        setLoading(true);
        try {
            const result = await apiCall('createChangeOrder', { id });
            if (result.success && result.result) {
                const newSlug = result.result._id;
                router.push(`/estimates/${newSlug}`);
                success('Change Order Created');
            } else {
                toastError('Failed to create change order');
                setLoading(false);
            }
        } catch (err) {
            console.error('Change order error:', err);
            toastError('Failed to create change order');
            setLoading(false);
        }
    };

    const handleCopy = () => {
        setCopyConfirmOpen(true);
    };

    const confirmCopy = async () => {
        setCopyConfirmOpen(false);
        setLoading(true);
        try {
            const result = await apiCall('copyEstimate', { id: estimate?._id });
            if (result.success && result.result) {
                const newSlug = result.result._id;
                router.push(`/estimates/${newSlug}`);
                success('Estimate copied to new V1');
            } else {
                toastError('Failed to copy estimate');
                setLoading(false);
            }
        } catch (err) {
            console.error('Copy error:', err);
            toastError('Failed to copy estimate');
            setLoading(false);
        }
    };

    const handleDeleteVersion = (versionId: string, versionNumber: number) => {
        setVersionToDelete({ id: versionId, number: versionNumber });
    };

    const processDeleteVersion = async () => {
        if (!versionToDelete) return;

        setLoading(true);
        try {
            // 1. Delete the specific version (backend now handles renumbering)
            const deleteRes = await apiCall('deleteEstimate', { id: versionToDelete.id });
            if (!deleteRes.success) {
                throw new Error(deleteRes.error || 'Failed to delete version');
            }

            success(`Version ${versionToDelete.number} deleted. Versions renumbered.`);

            // 2. Handle Navigation Logic
            if (estimate?.estimate) {
                const res = await apiCall('getEstimatesByProposal', { estimateNumber: estimate.estimate });
                if (res.success && res.result && res.result.length > 0) {
                    const sorted = res.result.sort((a: any, b: any) => (b.versionNumber || 0) - (a.versionNumber || 0));
                    // Go to the latest version
                    const latest = sorted[0];
                    const slug = latest._id;
                    window.location.href = `/estimates/${slug}`;
                    return;
                }
            }
            
            // Fallback
            router.push('/estimates');

        } catch (err) {
            console.error('Delete version error:', err);
            toastError('Failed to delete version');
            setLoading(false);
        } finally {
            setVersionToDelete(null);
        }
    };

    const handleVersionClick = (clickedId: string) => {
        // ALWAYS use clickedId (the _id) for navigation to ensure we hit the exact version/CO
        router.push(`/estimates/${clickedId}`);
    };

    // Toggle all sections
    const allExpanded = sections.every(s => openSections[s.id]);
    const handleToggleAll = () => {
        const newState: Record<string, boolean> = {};
        sections.forEach(s => { newState[s.id] = !allExpanded; });
        setOpenSections(newState);
    };

    // Get active catalog (helper)
    const getActiveCatalog = (): LineItem[] => {
        if (!activeSection) return [];
        switch (activeSection.id) {
            case 'Labor': return laborCatalog;
            case 'Equipment': return equipmentCatalog;
            case 'Material': return materialCatalog;
            case 'Overhead': return overheadCatalog;
            case 'Disposal': return disposalCatalog;
            case 'Subcontractor': return subcontractorCatalog;
            case 'Tools': return toolsCatalog;
            case 'Miscellaneous': return miscellaneousCatalog;
            default: return [];
        }
    };
    
    const handleSaveClient = async (clientData: any) => {
        try {
            const res = await apiCall('addClient', { item: clientData });
            if (res.success && res.result) {
                const newClient = res.result;
                const opt = {
                    id: newClient._id || newClient.recordId,
                    label: newClient.name,
                    value: newClient._id || newClient.recordId
                };
                setClientOptions(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)));
                
                // Update header directly
                handleHeaderUpdate('customerName', newClient.name);
                handleHeaderUpdate('customerId', newClient._id || newClient.recordId);
                
                // Auto-select primary contact/address if available
                const primaryContact = newClient.contacts?.find((c: any) => c.primary || c.active);
                if (primaryContact) {
                    handleHeaderUpdate('contactName', primaryContact.name);
                    // Use name as ID if backend doesn't provide specific contact ID
                    handleHeaderUpdate('contactId', primaryContact.name); 
                    handleHeaderUpdate('contactEmail', primaryContact.email || '');
                    handleHeaderUpdate('contactPhone', primaryContact.phone || '');
                } else {
                     handleHeaderUpdate('contactName', '');
                     handleHeaderUpdate('contactId', '');
                     handleHeaderUpdate('contactEmail', '');
                     handleHeaderUpdate('contactPhone', '');
                }

                const primaryAddress = newClient.addresses?.find((a: any) => (typeof a !== 'string' && a.primary)) || 
                                       (newClient.businessAddress ? { address: newClient.businessAddress } : null);
                
                if (primaryAddress) {
                    // Fix: Ensure we extract a string, handling cases where address might be falsy within object
                    let addrStr = '';
                    if (typeof primaryAddress === 'string') {
                        addrStr = primaryAddress;
                    } else if (primaryAddress && typeof primaryAddress === 'object') {
                        // Fallback order: address -> businessAddress -> fullAddress -> street
                        addrStr = primaryAddress.address || primaryAddress.businessAddress || primaryAddress.fullAddress || primaryAddress.street || '';
                    }
                    handleHeaderUpdate('jobAddress', addrStr);
                } else {
                    handleHeaderUpdate('jobAddress', '');
                }
                
                success('Client added successfully');
                setIsClientModalOpen(false);
                setNewClientName('');
            } else {
                toastError('Failed to add client: ' + (res.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            toastError('Error adding client');
        }
    };

    const handleAddClient = async (name: string) => {
        setNewClientName(name);
        setIsClientModalOpen(true);
        return null; // Return null so the header card keeps waiting or handles it via state update
    };

    const handleUpdateClientContacts = async (updatedContacts: any[]) => {
        if (!formData?.customerId) return;
        try {
            const res = await apiCall('updateClient', { id: formData.customerId, item: { contacts: updatedContacts } });
            if (res.success) {
                success('Client contacts updated');
                // Refresh client details
                const detailRes = await apiCall('getClientById', { id: formData.customerId });
                if (detailRes.success && detailRes.result) {
                    const client = detailRes.result;
                    const contacts = (client.contacts || []).map((c: any) => ({
                        id: c.name,
                        label: c.name,
                        value: c.name,
                        email: c.email,
                        phone: c.phone
                    }));
                    setContactOptions(contacts);
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleUpdateClientAddresses = async (updatedAddresses: string[]) => {
        if (!formData?.customerId) return;
        try {
            // Fetch current client to preserve primary address
            const detailRes = await apiCall('getClientById', { id: formData.customerId });
            if (!detailRes.success || !detailRes.result) return;
            
            const client = detailRes.result;
            const existingAddresses = client.addresses || [];
            
            // Re-integrate the primary address object if it was filtered out in the UI
            const primaryAddr = existingAddresses.find((a: any) => typeof a === 'object' && a.primary);
            
            let finalAddresses = [...updatedAddresses];
            if (primaryAddr) {
                const primaryStr = primaryAddr.fullAddress || primaryAddr.address || primaryAddr.street || '';
                // If the primary address isn't in the list (as a string or object), re-add it
                const alreadyIncluded = finalAddresses.some((a: any) => {
                    const s = typeof a === 'string' ? a : (a.fullAddress || a.address || a.street);
                    return s === primaryStr;
                });
                
                if (!alreadyIncluded && primaryStr) {
                    finalAddresses = [primaryAddr, ...finalAddresses];
                }
            }

            const res = await apiCall('updateClient', { id: formData.customerId, item: { addresses: finalAddresses } });
            if (res.success) {
                success('Client addresses updated');
                // The syncClientOptions effect will automatically handle the filtering and re-setting of addressOptions
            }
        } catch (e) { console.error(e); }
    };

    const handleAddConstant = async (data: any) => {
        try {
            const result = await apiCall('addConstant', { item: data });
            if (result.success) {
                const label = data.type?.replace(/([A-Z])/g, ' $1').trim() || 'Item';
                success(`${label.charAt(0).toUpperCase() + label.slice(1)} added`);
                loadCatalogs(); // Refresh catalogs to get the new service
                return result.result;
            }
        } catch (err) {
            console.error('Error adding constant:', err);
            toastError('Failed to add item');
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-[#F4F7FA]">
                <div className="flex-none">
                    <Header />
                </div>
                <FullEstimateSkeleton />
            </div>
        );
    }

    // Empty state
    if (!estimate || !formData) {
        return (
            <div className="flex flex-col h-screen bg-[#F4F7FA]">
                <div className="flex-none">
                    <Header />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center gap-4">
                    <div className="text-6xl">🚫</div>
                    <h3 className="text-xl font-bold text-gray-900">Estimate Not Found</h3>
                    <p className="text-gray-500">The requested estimate could not be loaded.</p>
                    <Button onClick={() => router.push('/estimates')}>Back to Estimates</Button>
                </div>
            </div>
        );
    }



    return (
        <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden">
            <div className="flex-none">
            <Header
                rightContent={
                    <div className="flex items-center gap-">
                        {/* Save Button */}
                        {unsavedChanges && (
                            <button
                                onClick={() => handleGlobalSave()}
                                disabled={saving}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-bold text-xs shadow-md disabled:opacity-50"
                            >
                                {saving ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                SAVE
                            </button>
                        )}

                        {/* Toggle All */}
                        {/* Section Visibility Dropdown */}
                        <div className="relative">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        id="section-visibility-btn"
                                        onClick={() => setShowSectionMenu(!showSectionMenu)}
                                        className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <LayoutTemplate className="w-5 h-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>View Options</p>
                                </TooltipContent>
                            </Tooltip>
                            <MyDropDown
                                isOpen={showSectionMenu}
                                onClose={() => setShowSectionMenu(false)}
                                anchorId="section-visibility-btn"
                                multiSelect={true}
                                positionMode="bottom"
                                options={[
                                    { id: 'estimateSummary', label: 'Estimate Summary', value: 'estimateSummary' },
                                    { id: 'estimateDocs', label: 'Job Docs', value: 'estimateDocs' },
                                    { id: 'lineItems', label: 'Line Items', value: 'lineItems' },
                                    { id: 'proposal', label: 'Proposal', value: 'proposal' }
                                ]}
                                selectedValues={Object.keys(visibleSections).filter(k => visibleSections[k as keyof typeof visibleSections])}
                                onSelect={(val) => {
                                    setVisibleSections(prev => ({
                                        ...prev,
                                        [val]: !prev[val as keyof typeof visibleSections]
                                    }));
                                }}
                                width="w-48"
                                hideSelectionIndicator={false}
                            />
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        {/* Refresh */}
                        {/* Back */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => router.push('/estimates')}
                                    className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Back to Estimates</p>
                            </TooltipContent>
                        </Tooltip>



                        {/* Copy */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                                >
                                    <Copy className="w-5 h-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Copy to New Estimate</p>
                            </TooltipContent>
                        </Tooltip>


                        {/* More Details */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setIsDetailsModalOpen(true)}
                                    className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-[#0F4C75] hover:bg-blue-50 rounded-xl transition-colors"
                                >
                                    <FileSpreadsheet className="w-5 h-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>More Details</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Delete */}

                    </div>
                }
            />
        </div>
            <div className="flex-1 overflow-y-auto min-h-0 w-full bg-[#F4F7FA]">
                {/* Section 1: Header Card */}
                <div className="w-full p-4">
                    {visibleSections.estimateSummary && (
                        /* Header Card */
                        <EstimateHeaderCard
                        formData={formData}
                        chartData={chartData}
                        versionHistory={versionHistory}
                        currentEstimateId={estimate?._id}
                        chartAnimate={chartAnimate}

                        onStatusChange={handleStatusChange}
                        statusOptions={statusOptions}
                        onServicesChange={handleServicesChange}
                        serviceOptions={serviceOptions}
                        fringeOptions={fringeOptions}
                        onFringeChange={handleFringeChange}
                        certifiedPayrollOptions={certifiedPayrollOptions}
                        employeeOptions={employeeOptions}
                        onHeaderUpdate={handleHeaderUpdate}
                        onAddConstant={handleAddConstant}
                        clientOptions={clientOptions}
                        contactOptions={contactOptions}
                        addressOptions={addressOptions}
                        onAddClient={handleAddClient}
                        onUpdateClientContacts={handleUpdateClientContacts}
                        onUpdateClientAddresses={handleUpdateClientAddresses}
                        onCloneVersion={handleClone}
                        onAddChangeOrder={handleAddChangeOrder}
                        onDeleteVersion={handleDeleteVersion}

                        onVersionClick={handleVersionClick}
                    />
                    )}
                    
                    {/* Estimate Docs Section */}
                    {visibleSections.estimateDocs && (
                        <div className="mt-6 mb-2 animation-fade-in">
                            <EstimateDocsCard 
                                formData={formData || {}} 
                                employees={employeesData} 
                                onUpdate={handleHeaderUpdate}
                                planningOptions={planningOptions}
                            />
                        </div>
                    )}
                </div>

                {/* Section 2: All Line Items (Full Screen Height with Scroll) */}
                {visibleSections.lineItems && (
                <div className="w-full px-4 pb-4 h-[calc(100vh-64px)] flex flex-col">
                    <EstimateLineItemsCard
                        sections={sections}
                        openSections={openSections}
                        setOpenSections={setOpenSections}
                        chartData={chartData}
                        setActiveSection={setActiveSection}
                        fringeRate={getFringeRate(formData?.fringe, fringeConstants)}
                        fringeConstants={fringeConstants}

                        onAddItem={(sectionId) => {
                            const section = sections.find(s => s.id === sectionId);
                            if (section) setActiveSection(section);
                        }}
                        onEditItem={(sectionId, item, field, value) => {
                            const section = sections.find(s => s.id === sectionId);
                            if (section && field && value !== undefined) {
                                handleItemUpdate(section, item, field, value);
                            }
                        }}
                        onDeleteItem={(sectionId, item) => {
                            const section = sections.find(s => s.id === sectionId);
                            if (section) handleDeleteItem(section, item);
                        }}
                        onExplain={handleExplain}
                    />
                </div>
                )}

                {/* Section 3: Proposal (Full Screen Height with Scroll) */}
                {visibleSections.proposal && templates.length > 0 && (
                    <div className="w-full px-6 pb-8 h-[calc(100vh-64px)] flex flex-col">
                        <div className="flex-1 h-full overflow-hidden">
                            <MyProposal
                                isEditing={isEditingTemplate}
                                pages={editorPages}
                                previewHtml={(formData?.services && formData.services.length > 0) ? (previewHtml || '') : ''}
                                selectedTemplateId={selectedTemplateId}
                                templates={templates}
                                services={formData?.services || []}
                                serviceOptions={serviceOptions}
                                isSaving={isSavingTemplate}
                                isGenerating={generatingProposal}
                                onPagesChange={setEditorPages}
                                onServicesChange={handleServicesChange}
                                onEditStart={() => {
                                    const sorted = [...(estimate?.proposals || [])].sort((a: any, b: any) => 
                                        new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
                                    );
                                    const proposalToEdit = viewingProposalId 
                                        ? sorted.find((p: any) => String(p._id) === viewingProposalId || String(p.generatedAt) === viewingProposalId)
                                        : sorted.find((p: any) => p.templateId === selectedTemplateId);

                                    const tmpl = templates.find(t => t._id === selectedTemplateId);
                                    
                                    if (proposalToEdit?.customPages && proposalToEdit.customPages.length > 0) {
                                        setEditorPages(proposalToEdit.customPages);
                                    } else if (tmpl?.pages && tmpl.pages.length > 0) {
                                        setEditorPages(tmpl.pages);
                                    } else if (selectedTemplateId === 'empty') {
                                        // Fallback for empty template if not yet generated/saved
                                        setEditorPages([{ 
                                            content: `<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);"> </strong></p><table><tbody><tr><td data-row="1"><strong style="color: rgb(0, 0, 0);">Proposal / Contract Number:</strong><span style="color: rgb(0, 0, 0);"> {{proposalNo}} </span></td><td data-row="1"><strong style="color: rgb(0, 0, 0);">Date: </strong><span style="color: rgb(0, 0, 0);">{{date}} </span></td></tr><tr><td data-row="2"><strong style="color: rgb(0, 0, 0);">Job Name:</strong><span style="color: rgb(0, 0, 0);"> {{projectTitle}} </span></td><td data-row="2"><strong style="color: rgb(0, 0, 0);">Job Address: </strong><span style="color: rgb(0, 0, 0);">{{jobAddress}} </span></td></tr></tbody></table><h2><br></h2><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);"><u>Customer Contact:</u></strong></p><p class="ql-align-justify">{{customerName}}</p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">{{contactPerson}} </span></p><p class="ql-align-justify">{{contactEmail}}</p><p class="ql-align-justify">{{contactPhone}}</p><h2><br></h2><p class="ql-align-center"><strong style="color: rgb(0, 0, 0);"><u>PROJECT SCOPE OF WORK</u></strong></p><p><br></p><p>Insert scope of work here...</p>` 
                                        }]);
                                    } else {
                                        setEditorPages([{ content: tmpl?.content || '' }]);
                                    }
                                    setIsEditingTemplate(true);
                                }}
                                onEditCancel={() => {
                                    setIsEditingTemplate(false);
                                    handlePreview(false);
                                }}
                                onSaveChanges={handleSaveProposalChanges}
                                onUpdateTemplate={() => {
                                    setSaveType('update');
                                    handleUpdateMainTemplate();
                                }}
                                onCreateTemplate={handleCreateTemplate}
                                onDownloadPdf={handleDownloadPdf}
                                proposals={[...(estimate?.proposals || [])].sort((a: any, b: any) => 
                                    new Date(b.generatedAt || b.createdAt || 0).getTime() - 
                                    new Date(a.generatedAt || a.createdAt || 0).getTime()
                                )}
                                selectedProposalId={viewingProposalId}
                                onRefreshFromTemplate={() => {
                                    if (selectedTemplateId === 'empty') {
                                        handlePreview(false, 'empty');
                                        success('Refreshed blank template');
                                        return;
                                    }
                                    if (selectedTemplateId) {
                                        // "Fetch Latest" ALWAYS creates a new version from the base template
                                        handleGenerateProposal(selectedTemplateId);
                                        success('Fetched latest content from template (New version created)');
                                    }
                                }}
                                onSelectProposal={(proposalId) => {
                                    if (proposalId === 'current' || !proposalId) {
                                        setViewingProposalId(null);
                                        // Reset to current state services
                                        if (estimate?.services) {
                                            setFormData(prev => prev ? { ...prev, services: estimate.services } : null);
                                        }
                                        handlePreview();
                                        return;
                                    }
                                    const proposal = estimate?.proposals?.find((p: any) => 
                                        (p._id && String(p._id) === proposalId) || 
                                        (p.generatedAt && String(p.generatedAt) === proposalId)
                                    );
                                    if (proposal?.htmlContent) {
                                        setViewingProposalId(proposalId);
                                        setPreviewHtml(proposal.htmlContent);
                                        setSelectedTemplateId(proposal.templateId);
                                        
                                        // Restore the services active at the time of this version
                                        if (proposal.services && Array.isArray(proposal.services)) {
                                            setFormData(prev => prev ? { ...prev, services: proposal.services } : null);
                                        }

                                        if (proposal.customPages && proposal.customPages.length > 0) {
                                            setEditorPages(proposal.customPages);
                                        }
                                    }
                                }}
                                quillRefs={quillRefs}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddItemModal
                isOpen={!!activeSection}
                onClose={() => setActiveSection(null)}
                section={activeSection as Parameters<typeof AddItemModal>[0]['section']}
                existingItems={activeSection ? activeSection.items : []}
                catalog={getActiveCatalog()}
                fringe={formData?.fringe}
                onSave={handleAddItem as Parameters<typeof AddItemModal>[0]['onSave']}
                fringeConstants={fringeConstants}
            />

            <LaborCalculationModal
                isOpen={!!explanationItem}
                onClose={() => setExplanationItem(null)}
                item={explanationItem}
                breakdown={breakdownData}
            />



            <ConfirmModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmDeleteItem}
                title="Delete Item"
                message="Are you sure you want to delete this item?"
                confirmText="Delete Item"
            />

            {/* Delete Version Confirmation Modal */}
            <ConfirmModal
                isOpen={!!versionToDelete}
                onClose={() => setVersionToDelete(null)}
                onConfirm={processDeleteVersion}
                title="Delete Version"
                message={`Are you sure you want to delete Version ${versionToDelete?.number}? This action cannot be undone.`}
                confirmText="Delete Version"
            />

            {/* Clone Confirmation Modal */}
            <ConfirmModal
                isOpen={!!cloneConfirmOpen}
                onClose={() => setCloneConfirmOpen(null)}
                onConfirm={confirmClone}
                title="Clone Estimate"
                message="Are you sure you want to clone this estimate version?"
                confirmText="Clone Version"
                variant="dark"
                icon={Copy}
            />

            {/* Copy Confirmation Modal */}
            <ConfirmModal
                isOpen={copyConfirmOpen}
                onClose={() => setCopyConfirmOpen(false)}
                onConfirm={confirmCopy}
                title="Copy Estimate"
                message="Are you sure you want to copy this estimate to a new project?"
                confirmText="Copy Estimate"
                variant="dark"
                icon={Copy}
            />

            {/* Change Order Confirmation Modal */}
            <ConfirmModal
                isOpen={!!changeOrderConfirmOpen}
                onClose={() => setChangeOrderConfirmOpen(null)}
                onConfirm={confirmAddChangeOrder}
                title="Create Change Order"
                message="Are you sure you want to create a change order from this version?"
                confirmText="Create Change Order"
                variant="dark"
                icon={FilePlus}
            />

            {/* PDF Preview Modal */}
            {showPdfPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-800">Proposal Preview</h3>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            // Get the HTML content for PDF
                                            const content = (previewHtml || '')

                                            if (!content.trim()) {
                                                toastError('No content to generate PDF');
                                                return;
                                            }

                                            // Call the server-side PDF generation API
                                            const response = await fetch('/api/generate-pdf', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({
                                                    html: content,
                                                    filename: `Proposal-${estimate?.proposalNo || 'Draft'}.pdf`
                                                })
                                            });

                                            if (!response.ok) {
                                                const errorData = await response.json();
                                                throw new Error(errorData.error || 'Failed to generate PDF');
                                            }

                                            // Get the PDF blob and trigger download
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `Proposal-${estimate?.proposalNo || 'Draft'}.pdf`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            window.URL.revokeObjectURL(url);
                                            
                                            success('PDF saved successfully!');
                                        } catch (err) {
                                            console.error('PDF Generation failed:', err);
                                            toastError('Failed to generate PDF');
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-1">
                                        <Download className="w-4 h-4" />
                                        Save PDF
                                    </span>
                                </Button>
                                <button
                                    onClick={() => setShowPdfPreview(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div id="pdf-preview-content" className="flex-1 overflow-auto bg-gray-100 flex flex-col gap-8 items-center cursor-default relative">
                            {generatingProposal && (
                                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                </div>
                            )}
                            {(() => {
                                const rawHtml = previewHtml || '';
                                // Robust split: First by the explicit new text marker, then by legacy markers
                                const pageContentArray = rawHtml
                                    .split('___PAGE_BREAK___')
                                    .flatMap(p => p.split(/(?:<!-- PAGEBREAK -->|<div style="page-break-after: always;[^"]*"><\/div>)/));

                                return pageContentArray.map((pageHtml, idx) => (
                                    <div key={idx} className="flex flex-col items-center w-full">
                                        <div
                                            className="bg-white shadow-2xl mx-auto relative"
                                            style={{
                                                width: '8.5in',
                                                height: '11in',
                                                padding: '0.5in',
                                                fontFamily: 'Inter, sans-serif',
                                                fontSize: '11pt',
                                                lineHeight: '1.4',
                                                overflow: 'hidden',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            <div
                                                className="proposal-content ql-editor h-full"
                                                style={{ overflow: 'hidden' }}
                                                dangerouslySetInnerHTML={{ __html: pageHtml }}
                                            />
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Save Template Modal */}
            <Modal
                isOpen={showSaveTemplateModal}
                onClose={() => setShowSaveTemplateModal(false)}
                title="Save As New Template"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)}>Cancel</Button>
                        <Button 
                            variant="primary" 
                            onClick={handleUpdateMainTemplate}
                            disabled={!newTemplateTitle.trim() || isSavingTemplate}
                        >
                            {isSavingTemplate ? 'Saving...' : 'Save Template'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">Enter a name for your new template. This will create a copy of the current content.</p>
                    <input 
                        type="text" 
                        value={newTemplateTitle}
                        onChange={(e) => setNewTemplateTitle(e.target.value)}
                        placeholder="Template Name e.g., Residential Proposal V2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        autoFocus
                    />
                </div>
            </Modal>
            {/* Styles for tight spacing matching Editor */}
            <style jsx global>{`
                .ql-editor p {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
                .ql-editor td, .ql-editor th {
                    padding: 2px 4px !important;
                }
                .ql-editor li {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
                .ql-editor {
                    padding: 0 !important;
                    font-family: Arial, sans-serif !important;
                    line-height: 1.15 !important;
                }
            `}</style>
            <EstimateDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                formData={formData}
                customerId={formData.customerId}
                onUpdate={(field, value) => handleHeaderUpdate(field as string, value)}
            />
            
            <ClientModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                onSave={handleSaveClient}
                initialClient={{ name: newClientName }}
                employees={employeesData.map(e => ({
                    _id: e._id,
                    firstName: e.firstName,
                    lastName: e.lastName,
                    profilePicture: e.profilePicture,
                    email: e.email
                }))}
            />

        </div>
    );
}
