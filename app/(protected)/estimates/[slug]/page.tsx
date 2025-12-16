'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, RefreshCw, Plus, Trash2, ChevronsUp, ChevronsDown, Copy, FileText, LayoutTemplate } from 'lucide-react';
import { Header, Loading, Button, AddButton, ConfirmModal, SkeletonEstimateHeader, SkeletonAccordion } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';
import 'react-quill-new/dist/quill.snow.css';
import {
    EstimateHeaderCard,
    AccordionSection,
    LineItemsTable,
    AddItemModal,
    LaborCalculationModal
} from './components';
import {
    getLaborBreakdown,
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
}

interface Estimate {
    _id: string;
    estimate?: string;
    date?: string;
    customerName?: string;
    proposalNo?: string;
    versionNumber?: number;
    bidMarkUp?: string | number;
    status?: string;
    fringe?: string;
    directionalDrilling?: boolean;
    excavationBackfill?: boolean;
    hydroExcavation?: boolean;
    potholingCoring?: boolean;
    asphaltConcrete?: boolean;
    labor?: LineItem[];
    equipment?: LineItem[];
    material?: LineItem[];
    tools?: LineItem[];
    overhead?: LineItem[];
    subcontractor?: LineItem[];
    disposal?: LineItem[];
    miscellaneous?: LineItem[];
    proposal?: {
        templateId: string;
        templateVersion: number;
        generatedAt: Date | string;
        pdfUrl?: string;
        htmlContent: string;
    };
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
}

// Section configurations
const baseSectionConfigs = [
    {
        id: 'Labor', title: 'Labor', key: 'labor',
        headers: ['Labor', 'Classification', 'Sub Classification', 'Base Pay', 'Quantity', 'Days', 'OT PD', 'W. Comp', 'Payroll Tax', 'Total'],
        fields: ['labor', 'classification', 'subClassification', 'basePay', 'quantity', 'days', 'otPd', 'wCompPercent', 'payrollTaxesPercent', 'total'],
        formFields: ['classification', 'subClassification', 'fringe', 'basePay', 'quantity', 'days', 'otPd', 'wCompPercent', 'payrollTaxesPercent'],
        formHeaders: ['Classification', 'Sub Classification', 'Fringe', 'Base Pay', 'Quantity', 'Days', 'OT PD', 'W. Comp %', 'Payroll Tax %'],
        editableFields: ['quantity', 'days', 'otPd', 'basePay']
    },
    {
        id: 'Equipment', title: 'Equipment', key: 'equipment',
        headers: ['Equipment / Machine', 'Classification', 'Sub Classification', 'Supplier', 'Qty', 'Times', 'UOM', 'Daily Cost', 'Weekly Cost', 'Monthly Cost', 'Fuel', 'Total'],
        fields: ['equipmentMachine', 'classification', 'subClassification', 'supplier', 'quantity', 'times', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost', 'total'],
        editableFields: ['supplier', 'quantity', 'times', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost']
    },
    {
        id: 'Material', title: 'Material', key: 'material',
        headers: ['Material', 'Classification', 'Sub Classification', 'Supplier', 'Qty', 'UOM', 'Cost', 'Taxes', 'Total'],
        fields: ['material', 'classification', 'subClassification', 'supplier', 'quantity', 'uom', 'cost', 'taxes', 'total'],
        editableFields: ['classification', 'subClassification', 'supplier', 'uom', 'cost', 'taxes', 'quantity']
    },
    {
        id: 'Tools', title: 'Tools', key: 'tools',
        headers: ['Tool', 'Classification', 'Sub Classification', 'UOM', 'Supplier', 'Cost', 'Quantity', 'Taxes', 'Total'],
        fields: ['tool', 'classification', 'subClassification', 'uom', 'supplier', 'cost', 'quantity', 'taxes', 'total'],
        editableFields: ['quantity', 'cost']
    },
    {
        id: 'Overhead', title: 'Overhead', key: 'overhead',
        headers: ['Overhead', 'Classification', 'Sub Classification', 'Days', 'Hours', 'Hourly Rate', 'Daily Rate', 'Total'],
        fields: ['overhead', 'classification', 'subClassification', 'days', 'hours', 'hourlyRate', 'dailyRate', 'total'],
        formFields: ['overhead', 'classification', 'subClassification', 'hourlyRate', 'dailyRate'],
        formHeaders: ['Overhead', 'Classification', 'Sub Classification', 'Hourly Cost', 'Daily Cost'],
        editableFields: ['classification', 'subClassification', 'days', 'hourlyRate']
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
        editableFields: ['classification', 'subClassification', 'uom', 'quantity', 'cost']
    },
    {
        id: 'Miscellaneous', title: 'Miscellaneous', key: 'miscellaneous',
        headers: ['Item', 'Classification', 'Quantity', 'UOM', 'Cost', 'Total'],
        fields: ['item', 'classification', 'quantity', 'uom', 'cost', 'total'],
        formFields: ['item', 'classification', 'uom', 'cost'],
        formHeaders: ['Item', 'Classification', 'UOM', 'Cost'],
        editableFields: ['classification', 'quantity', 'uom', 'cost']
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
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Proposal State
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const proposalRef = useRef<HTMLDivElement>(null);
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

    // Catalogs
    const [laborCatalog, setLaborCatalog] = useState<LineItem[]>([]);
    const [equipmentCatalog, setEquipmentCatalog] = useState<LineItem[]>([]);
    const [materialCatalog, setMaterialCatalog] = useState<LineItem[]>([]);
    const [overheadCatalog, setOverheadCatalog] = useState<LineItem[]>([]);
    const [disposalCatalog, setDisposalCatalog] = useState<LineItem[]>([]);
    const [subcontractorCatalog, setSubcontractorCatalog] = useState<LineItem[]>([]);
    const [miscellaneousCatalog, setMiscellaneousCatalog] = useState<LineItem[]>([]);
    const [fringeConstants, setFringeConstants] = useState<FringeConstant[]>([]);
    const [catalogsLoaded, setCatalogsLoaded] = useState(false);
    const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);

    // Modals
    const [activeSection, setActiveSection] = useState<SectionConfig | null>(null);
    const [explanationItem, setExplanationItem] = useState<LineItem | null>(null);
    const [breakdownData, setBreakdownData] = useState<LaborBreakdown | null>(null);
    const [confirmDeleteEstimate, setConfirmDeleteEstimate] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ section: SectionConfig; item: LineItem } | null>(null);

    // Refs
    const toastShownRef = useRef<string | null>(null);

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
                result = await apiCall('getEstimateById', { id: slug });
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

                // Check for local draft using the fetched ID
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
                const { equipment, labor, material, overhead, subcontractor, disposal, miscellaneous, constant } = result.result;
                setEquipmentCatalog(equipment || []);
                setLaborCatalog(labor || []);
                setMaterialCatalog(material || []);
                setOverheadCatalog(overhead || []);
                setSubcontractorCatalog(subcontractor || []);
                setDisposalCatalog(disposal || []);
                setMiscellaneousCatalog(miscellaneous || []);
                setFringeConstants((constant || []) as unknown as FringeConstant[]);
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
                const sorted = result.result.sort((a: VersionEntry, b: VersionEntry) =>
                    (b.versionNumber || 0) - (a.versionNumber || 0)
                );
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

    // Restore saved template selection when estimate loads
    useEffect(() => {
        if (estimate?.templateId && templates.length > 0) {
            setSelectedTemplateId(String(estimate.templateId));
        }
    }, [estimate?.templateId, templates.length]);

    // Initial Sort & Expand Logic
    useEffect(() => {
        if (catalogsLoaded && estimate && !initialLoadComplete) {
            // 1. Calculate sections
            const calculated = calculateSections(estimate, fringeConstants);

            // 2. Determine sort order (desc items total)
            const sorted = [...calculated].sort((a, b) => {
                const totalA = a.items.reduce((sum, i) => sum + (i.total || 0), 0);
                const totalB = b.items.reduce((sum, i) => sum + (i.total || 0), 0);
                return totalB - totalA;
            });
            setSectionOrder(sorted.map(s => s.id));

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

    // Save draft to local storage
    useEffect(() => {
        if (unsavedChanges && estimate && formData && estimate._id) {
            const draftKey = `${DRAFT_KEY_PREFIX}${estimate._id}`;
            const draftData = {
                estimate,
                formData,
                timestamp: Date.now()
            };
            localStorage.setItem(draftKey, JSON.stringify(draftData));
        }
    }, [unsavedChanges, estimate, formData]);

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

    // Live update current version total in history
    useEffect(() => {
        if (!estimate?._id || !chartData) return;

        setVersionHistory(prev => {
            const index = prev.findIndex(v => v._id === estimate._id);
            if (index === -1) return prev;

            // Only update if changed to avoid loops
            // Use a small epsilon for float comparison or exact match if preferred
            if (Math.abs((prev[index].totalAmount || 0) - chartData.grandTotal) < 0.01) return prev;

            const newHistory = [...prev];
            newHistory[index] = {
                ...newHistory[index],
                totalAmount: chartData.grandTotal
            };
            return newHistory;
        });
    }, [chartData.grandTotal, estimate?._id]);

    // Handlers
    const handlePreview = async (forceEditMode?: boolean) => {
        if (!selectedTemplateId || !estimate) return;
        setGeneratingProposal(true);
        const editMode = forceEditMode !== undefined ? forceEditMode : isEditingTemplate;
        const result = await apiCall('previewProposal', { templateId: selectedTemplateId, estimateId: estimate._id, editMode });
        if (result.success && result.result) {
            setPreviewHtml(result.result.html);
        } else {
            toastError('Failed to generate preview');
        }
        setGeneratingProposal(false);
    };

    const handleGenerateProposal = async () => {
        if (!selectedTemplateId || !estimate) return;
        setGeneratingProposal(true);

        // Extract custom variable values from the DOM
        const customVariables: Record<string, string> = {};
        if (proposalRef.current) {
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

        const result = await apiCall('generateProposal', {
            templateId: selectedTemplateId,
            estimateId: estimate._id,
            customVariables
        });
        if (result.success && result.result) {
            setPreviewHtml(result.result.html);
            setIsEditingTemplate(false); // Exit edit mode after generating
            success('Proposal generated and saved');
            loadEstimate(); // Reload to get snapshot info
        } else {
            toastError('Failed to generate proposal');
        }
        setGeneratingProposal(false);
    };

    const handleHeaderUpdate = (field: string, value: string | number) => {
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
        setUnsavedChanges(true);
    };

    const handleServiceToggle = (serviceId: string) => {
        if (!formData) return;
        const newVal = !formData[serviceId];
        setFormData(prev => prev ? { ...prev, [serviceId]: newVal } : null);
        setUnsavedChanges(true);
    };

    const handleStatusToggle = () => {
        if (!formData) return;
        const newStatus = formData.status === 'confirmed' ? 'draft' : 'confirmed';
        setFormData(prev => prev ? { ...prev, status: newStatus } : null);
        setUnsavedChanges(true);
        success(`Status set to ${newStatus}`);
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

    const handleGlobalSave = async () => {
        if (!estimate || !formData) return;
        setSaving(true);
        try {
            const payload = {
                id: estimate._id,
                ...formData,
                bidMarkUp: String(formData.bidMarkUp).includes('%') ? formData.bidMarkUp : `${formData.bidMarkUp}%`,
                subTotal: chartData.subTotal,
                margin: chartData.grandTotal - chartData.subTotal,
                grandTotal: chartData.grandTotal,
                labor: estimate.labor,
                equipment: estimate.equipment,
                material: estimate.material,
                tools: estimate.tools,
                overhead: estimate.overhead,
                subcontractor: estimate.subcontractor,
                disposal: estimate.disposal,
                miscellaneous: estimate.miscellaneous
            };

            const result = await apiCall('updateEstimate', payload);
            if (!result.success) throw new Error(result.error || 'Save failed');

            success('Estimate saved successfully');
            localStorage.removeItem(`${DRAFT_KEY_PREFIX}${estimate._id}`);
            setUnsavedChanges(false);

            // Re-Sort on Save
            const calculated = calculateSections(estimate, fringeConstants);
            const sorted = [...calculated].sort((a, b) => {
                const totalA = a.items.reduce((sum, i) => sum + (i.total || 0), 0);
                const totalB = b.items.reduce((sum, i) => sum + (i.total || 0), 0);
                return totalB - totalA;
            });
            setSectionOrder(sorted.map(s => s.id));

        } catch (err) {
            console.error('Save error:', err);
            toastError('Failed to save estimate');
        } finally {
            setSaving(false);
        }
    };

    const handleClone = async () => {
        setLoading(true);
        try {
            const result = await apiCall('cloneEstimate', { id: estimate?._id });
            if (result.success && result.result) {
                const newSlug = result.result.estimate ? `${result.result.estimate}-V${result.result.versionNumber || 1}` : result.result._id;
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

    const handleCopy = async () => {
        setLoading(true);
        try {
            const result = await apiCall('copyEstimate', { id: estimate?._id });
            if (result.success && result.result) {
                const newSlug = result.result.estimate ? `${result.result.estimate}-V${result.result.versionNumber || 1}` : result.result._id;
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

    const handleDelete = async () => {
        setConfirmDeleteEstimate(true);
    };

    const performDeleteEstimate = async () => {
        setLoading(true);
        try {
            await apiCall('deleteEstimate', { id: estimate?._id });
            router.push('/estimates');
        } catch (err) {
            console.error('Delete error:', err);
            toastError('Failed to delete estimate');
            setLoading(false);
        }
    };

    const handleConvertToProposal = () => {
        success('Convert to Proposal feature coming soon');
    };

    const handleVersionClick = (clickedId: string) => {
        const clickedVersion = versionHistory.find(v => v._id === clickedId);
        if (clickedVersion && clickedVersion.estimate) {
            router.push(`/estimates/${clickedVersion.estimate}-V${clickedVersion.versionNumber || 1}`);
        } else {
            router.push(`/estimates/${clickedId}`);
        }
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
            case 'Miscellaneous': return miscellaneousCatalog;
            default: return [];
        }
    };

    // Loading state
    if (loading) {
        return (
            <>
                <Header />
                <main className="flex-1 overflow-y-auto">
                    <div className="w-full px-8 py-6">
                        <SkeletonEstimateHeader />
                    </div>
                    <div className="w-full space-y-4 pb-20 px-8">
                        <SkeletonAccordion />
                        <SkeletonAccordion />
                        <SkeletonAccordion />
                    </div>
                </main>
            </>
        );
    }

    // Empty state
    if (!estimate || !formData) {
        return (
            <>
                <Header />
                <div className="flex flex-col items-center justify-center flex-1 gap-4">
                    <div className="text-6xl">🚫</div>
                    <h3 className="text-xl font-bold text-gray-900">Estimate Not Found</h3>
                    <p className="text-gray-500">The requested estimate could not be loaded.</p>
                    <Button onClick={() => router.push('/estimates')}>Back to Estimates</Button>
                </div>
            </>
        );
    }



    return (
        <>
            <Header
                rightContent={
                    <div className="flex items-center gap-2">
                        {/* Save Button */}
                        {unsavedChanges && (
                            <button
                                onClick={handleGlobalSave}
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
                        <button
                            onClick={handleToggleAll}
                            className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={allExpanded ? "Collapse All" : "Expand All"}
                        >
                            {allExpanded ? <ChevronsUp className="w-5 h-5" /> : <ChevronsDown className="w-5 h-5" />}
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        {/* Refresh */}
                        <button
                            onClick={() => loadEstimate(true)}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        {/* Clone */}
                        <button
                            onClick={handleClone}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-bold text-xs shadow-md"
                            title="Clone Estimate"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Clone V{formData.versionNumber || 1}
                        </button>

                        {/* Copy */}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-bold text-xs shadow-md"
                            title="Copy to New Estimate"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                        </button>

                        {/* Convert to Proposal */}
                        <button
                            onClick={handleConvertToProposal}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-bold text-xs shadow-md"
                            title="Convert to Proposal"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Proposal
                        </button>

                        {/* Delete */}
                        <button
                            onClick={handleDelete}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete Estimate"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto">
                <div className="w-full px-8 py-6">
                    {/* Header Card */}
                    <EstimateHeaderCard
                        formData={formData}
                        chartData={chartData}
                        versionHistory={versionHistory}
                        currentEstimateId={estimate?._id}
                        chartAnimate={chartAnimate}
                        onServiceToggle={handleServiceToggle}
                        onStatusToggle={handleStatusToggle}
                        onHeaderUpdate={handleHeaderUpdate}
                        onVersionClick={handleVersionClick}
                    />
                </div>

                {/* Accordion Sections */}
                <div className="w-full space-y-4 pb-20 px-8">
                    {sections.map(section => (
                        <AccordionSection
                            key={section.id}
                            title={section.title}
                            isOpen={openSections[section.id] || false}
                            onToggle={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                            itemCount={section.items.length}
                            sectionTotal={section.items.reduce((sum, i) => sum + (i.total || 0), 0)}
                            grandTotal={chartData.grandTotal}
                            color={section.color}
                            onAdd={() => setActiveSection(section)}
                        >
                            <LineItemsTable
                                sectionId={section.id}
                                headers={section.headers}
                                items={section.items}
                                fields={section.fields}
                                editableFields={section.editableFields}
                                onUpdateItem={(item, field, value) => handleItemUpdate(section, item, field, value)}
                                onExplain={section.id === 'Labor' ? handleExplain : undefined}
                                onDelete={(item) => handleDeleteItem(section, item)}
                            />
                        </AccordionSection>
                    ))}

                    {/* Proposal Content Section */}
                    {templates.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <LayoutTemplate className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-gray-800">Proposal Content</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedTemplateId}
                                        onChange={(e) => {
                                            const newId = e.target.value;
                                            setSelectedTemplateId(newId);
                                            if (newId) {
                                                // Auto-apply template when selected
                                                setTimeout(() => handlePreview(false), 100);
                                            } else {
                                                setPreviewHtml('');
                                            }
                                        }}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">Select Template...</option>
                                        {templates.map(t => (
                                            <option key={t._id} value={t._id}>{t.title}</option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={async () => {
                                            await handlePreview(false); // Get view mode preview
                                            setShowPdfPreview(true);
                                        }}
                                        variant="secondary"
                                        size="sm"
                                        disabled={generatingProposal || !selectedTemplateId}
                                    >
                                        {generatingProposal ? 'Generating...' : 'Preview'}
                                    </Button>
                                    {(previewHtml || estimate?.proposal?.htmlContent) && (
                                        <Button
                                            onClick={() => {
                                                if (isEditingTemplate) {
                                                    handleGenerateProposal();
                                                } else {
                                                    setIsEditingTemplate(true);
                                                    handlePreview(true);
                                                }
                                            }}
                                            variant={isEditingTemplate ? 'primary' : 'secondary'}
                                            size="sm"
                                            disabled={generatingProposal}
                                        >
                                            {generatingProposal ? 'Saving...' : (isEditingTemplate ? 'Save' : 'Edit')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {(previewHtml || (estimate?.proposal?.htmlContent)) ? (
                                <div className="p-8 bg-gray-50 min-h-[400px] ql-snow">
                                    <div
                                        ref={proposalRef}
                                        className="bg-white shadow-lg mx-auto max-w-6xl min-h-[800px] proposal-content ql-editor p-12"
                                        dangerouslySetInnerHTML={{ __html: previewHtml || estimate?.proposal?.htmlContent || '' }}
                                    />
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-400 bg-gray-50">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Select a template and click Preview to see the proposal document.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

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
                isOpen={confirmDeleteEstimate}
                onClose={() => setConfirmDeleteEstimate(false)}
                onConfirm={performDeleteEstimate}
                title="Delete Estimate"
                message="Are you sure you want to delete this estimate? This action cannot be undone."
                confirmText="Delete"
            />

            <ConfirmModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmDeleteItem}
                title="Delete Item"
                message="Are you sure you want to delete this item?"
                confirmText="Delete Item"
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
                                    onClick={() => {
                                        const printWindow = window.open('', '_blank');
                                        if (printWindow) {
                                            printWindow.document.write(`
                                                <html>
                                                <head>
                                                    <title>Proposal - ${estimate?.proposalNo || 'Print'}</title>
                                                    <style>
                                                        body { font-family: 'Inter', sans-serif; padding: 40px; }
                                                        @media print { body { padding: 0; } }
                                                    </style>
                                                </head>
                                                <body>${previewHtml || estimate?.proposal?.htmlContent || ''}</body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                            printWindow.print();
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Print / Save PDF
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
                        <div className="flex-1 overflow-auto p-6 bg-gray-100">
                            <div
                                className="bg-white shadow-lg mx-auto max-w-4xl p-12 min-h-[800px]"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: previewHtml || estimate?.proposal?.htmlContent || '' }}
                            />
                        </div>
                    </div>
                </div>
            )}


        </>
    );
}
