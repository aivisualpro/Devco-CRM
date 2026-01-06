'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, RefreshCw, Plus, Trash2, ChevronsUp, ChevronsDown, Copy, FileText, LayoutTemplate, ArrowLeft, Download, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Header, Loading, Button, AddButton, ConfirmModal, SkeletonEstimateHeader, SkeletonAccordion, Modal, LetterPageEditor } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';
import 'react-quill-new/dist/quill.snow.css';
import dynamic from 'next/dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import {
    EstimateHeaderCard,
    AccordionSection,
    LineItemsTable,
    AddItemModal,
    LaborCalculationModal,
    TemplateSelector,
    EstimateDetailsModal
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

const SYSTEM_VARIABLES = [
    { name: 'proposalNo', label: 'Proposal No.' },
    { name: 'date', label: 'Proposal Date' },
    { name: 'projectTitle', label: 'Project Name' },
    { name: 'jobAddress', label: 'Job Address' },
    { name: 'customerName', label: 'Client Name' },
    { name: 'contactPerson', label: 'Contact Person' },
    { name: 'contactAddress', label: 'Contact Address' },
    { name: 'contactPhone', label: 'Contact Phone' },
    { name: 'contactEmail', label: 'Contact Email' },
    { name: 'aggregations.grandTotal', label: 'Estimate Grand Total' },
    { name: 'aggregations.subTotal', label: 'Estimate Sub Total' },
    { name: 'aggregations.laborTotal', label: 'Estimate Labor' },
    { name: 'aggregations.toolsTotal', label: 'Estimate Tools' },
    { name: 'aggregations.materialTotal', label: 'Estimate Materials' },
    { name: 'aggregations.equipmentTotal', label: 'Estimate Equipment' },
    { name: 'aggregations.overheadTotal', label: 'Estimate Overhead' },
    { name: 'aggregations.subcontractorTotal', label: 'Estimate Subcontractor' },
    { name: 'aggregations.disposalTotal', label: 'Estimate Disposal' },
    { name: 'aggregations.miscellaneousTotal', label: 'Estimate Miscellaneous' },
];

const CUSTOM_VARIABLES = [
    { name: 'customText', label: 'Custom Text', type: 'text', description: 'Plain text field' },
    { name: 'customCurrency', label: 'Custom Currency', type: 'currency', description: 'Shows as $X,XXX.XX' },
    { name: 'customNumber', label: 'Custom Number', type: 'decimal', description: 'Shows as X,XXX.XX' },
];

const LINE_ITEM_VARIABLES = [
    { name: 'lineItemLabor', label: 'Labor Item', category: 'labor', description: 'Select & insert labor item' },
    { name: 'lineItemEquipment', label: 'Equipment Item', category: 'equipment', description: 'Select & insert equipment item' },
    { name: 'lineItemMaterial', label: 'Material Item', category: 'material', description: 'Select & insert material item' },
    { name: 'lineItemTool', label: 'Tool Item', category: 'tool', description: 'Select & insert tool item' },
    { name: 'lineItemOverhead', label: 'Overhead Item', category: 'overhead', description: 'Select & insert overhead item' },
    { name: 'lineItemSubcontractor', label: 'Subcontractor Item', category: 'subcontractor', description: 'Select & insert subcontractor item' },
    { name: 'lineItemDisposal', label: 'Disposal Item', category: 'disposal', description: 'Select & insert disposal item' },
    { name: 'lineItemMiscellaneous', label: 'Miscellaneous Item', category: 'miscellaneous', description: 'Select & insert misc item' },
];

// Neumorphic Sidebar Accordion
function SidebarAccordion({ title, children, defaultOpen = false, rightAction }: { title: string, children: React.ReactNode, defaultOpen?: boolean, rightAction?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="w-full rounded-[16px] p-4 mb-4" style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px #b8b9be, -4px -4px 8px #ffffff' }}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider select-none">{title}</h4>
                </div>
                {rightAction && <div onClick={(e) => e.stopPropagation()}>{rightAction}</div>}
            </div>
            {isOpen && <div className="mt-3">{children}</div>}
        </div>
    );
}

const DRAFT_KEY_PREFIX = 'estimate_draft_';

// Types
interface Template {
    _id: string;
    title: string;
    content?: string;
    pages?: { content: string }[];
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
    proposalWriter?: string;
    certifiedPayroll?: string;
    oldOrNew?: string;
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
        headers: ['Equipment / Machine', 'Classification', 'Sub Classification', 'Supplier', 'Qty', 'Times', 'UOM', 'Daily Cost', 'Weekly Cost', 'Monthly Cost', 'Fuel', 'Delivery & Pickup', 'Total'],
        fields: ['equipmentMachine', 'classification', 'subClassification', 'supplier', 'quantity', 'times', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost', 'deliveryPickup', 'total'],
        editableFields: ['supplier', 'quantity', 'times', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost', 'deliveryPickup']
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
    const [certifiedPayrollOptions, setCertifiedPayrollOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<{ id: string; label: string; value: string; color?: string }[]>([]);
    const [clientOptions, setClientOptions] = useState<{ id: string; label: string; value: string }[]>([]);
    const [contactOptions, setContactOptions] = useState<{ id: string; label: string; value: string; email?: string; phone?: string }[]>([]);
    const [addressOptions, setAddressOptions] = useState<{ id: string; label: string; value: string }[]>([]);
    const [catalogsLoaded, setCatalogsLoaded] = useState(false);


    const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);

    // Modals
    const [activeSection, setActiveSection] = useState<SectionConfig | null>(null);
    const [explanationItem, setExplanationItem] = useState<LineItem | null>(null);
    const [breakdownData, setBreakdownData] = useState<LaborBreakdown | null>(null);
    const [confirmDeleteEstimate, setConfirmDeleteEstimate] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ section: SectionConfig; item: LineItem } | null>(null);
    
    // Template Editing State
    const [editorContent, setEditorContent] = useState('');
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [newTemplateTitle, setNewTemplateTitle] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [saveType, setSaveType] = useState<'update' | 'create'>('update');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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
                        if (item.days !== undefined) {
                            const days = parseNum(item.days);
                            const hours = days * 8;
                            const calculatedItem = { ...item, hours };
                            total = calculateOverheadTotal(calculatedItem);
                            // Return item with enforced hours
                            return { ...item, hours, total };
                        }
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

                console.log('Loaded Constants:', constant);

                // Process Status Options
                const statuses = (constant || [])
                    .filter((c: any) => {
                        const type = (c.type || c.category || '').toLowerCase();
                        return type === 'estimate status' || type === 'status';
                    })
                    .map((c: any) => ({
                        id: c._id,
                        label: c.description || c.value,
                        value: c.description || c.value,
                        color: c.color
                    }));
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
                    }));
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
                    }));
                console.log('Loaded Fringe Options:', fringes);
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
                    }));
                console.log('Loaded Certified Payroll Options:', certifiedPayroll);
                setCertifiedPayrollOptions(certifiedPayroll);

                // Fetch Employees for Proposal Writer
                const employeeRes = await apiCall('getEmployees');
                if (employeeRes.success && employeeRes.result) {
                    const employees = employeeRes.result
                        .filter((emp: any) => emp.appRole === 'Admin')
                        .map((emp: any) => ({
                            id: emp._id,
                            label: `${emp.firstName} ${emp.lastName}`,
                            value: emp._id,
                            profilePicture: emp.profilePicture
                        }));

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

    // Fetch client details when customerId changes
    useEffect(() => {
        if (!formData?.customerId) {
            setContactOptions([]);
            setAddressOptions([]);
            return;
        }

        const fetchClientDetails = async () => {
            try {
                const res = await apiCall('getClientById', { id: formData.customerId });
                if (res.success && res.result) {
                    const client = res.result;

                    // Contacts
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
                                email: client.email,
                                phone: client.phone
                            });
                        }
                    }
                    setContactOptions(contacts);

                    // Addresses
                    const addresses = (client.addresses || []).map((a: string) => ({
                        id: a,
                        label: a,
                        value: a
                    }));
                    if (client.businessAddress && !addresses.find((a: any) => a.label === client.businessAddress)) {
                        addresses.unshift({
                            id: client.businessAddress,
                            label: client.businessAddress,
                            value: client.businessAddress
                        });
                    }
                    setAddressOptions(addresses);
                }
            } catch (err) {
                console.error('Error fetching client details:', err);
            }
        };

        fetchClientDetails();
    }, [formData?.customerId]);

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

    // Auto-save logic (debounced 1.5s)
    useEffect(() => {
        if (!unsavedChanges || !estimate || !formData || saving) return;

        const timer = setTimeout(() => {
            handleGlobalSave({ silent: true });
        }, 1500);

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
            if (Math.abs((prev[index].totalAmount || 0) - chartData.grandTotal) < 0.01) return prev;

            const newHistory = [...prev];
            newHistory[index] = {
                ...newHistory[index],
                totalAmount: chartData.grandTotal
            };
            return newHistory;
        });
    }, [chartData.grandTotal, estimate?._id]);

    // Auto-refresh preview when data changes (debounce 1s)
    useEffect(() => {
        // Run if we have a template selected and not in manual edit mode
        if (!selectedTemplateId || isEditingTemplate || generatingProposal || !estimate) return;

        const timer = setTimeout(() => {
            handlePreview(false);
        }, 1000);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, chartData, estimate, selectedTemplateId]);



    // Handlers
    const handleSaveTemplate = async () => {
        // if (!editorContent) return; // Allow empty
        setIsSavingTemplate(true);

        const action = saveType === 'create' ? 'addTemplate' : 'updateTemplate';
        const payload: any = {};
        
        const pagesToSave = editorPages;
        const contentToSave = editorPages[0]?.content || '';

        if (saveType === 'create') {
            payload.item = {
                title: newTemplateTitle,
                content: contentToSave,
                pages: pagesToSave
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
                success(saveType === 'create' ? 'Template created' : 'Template updated');
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

    const handlePreview = async (forceEditMode?: boolean, explicitTemplateId?: string) => {
        const tid = explicitTemplateId || selectedTemplateId;
        if (!tid || !estimate) return;
        setGeneratingProposal(true);

        // Construct current estimate state (merging unsaved changes)
        // We need to merge header form data + calculated totals + current line items
        const currentEstimate = {
            ...estimate,
            ...formData, // Overwrite with header form data (Project Name, etc.)
            ...chartData // Overwrite with calculated totals (Grand Total, etc.)
        };

        const editMode = forceEditMode !== undefined ? forceEditMode : isEditingTemplate;
        const result = await apiCall('previewProposal', {
            templateId: tid,
            estimateId: estimate._id,
            editMode,
            estimateData: currentEstimate // Pass overrides
        });

        if (result.success && result.result) {
            setPreviewHtml(result.result.html);
        } else {
            toastError('Failed to generate preview');
        }
        setGeneratingProposal(false);
    };

    const handleGenerateProposal = async (explicitTemplateId?: string) => {
        const tid = explicitTemplateId || selectedTemplateId;
        if (!tid || !estimate) return;
        setGeneratingProposal(true);

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
            setPreviewHtml(result.result.html);
            setIsEditingTemplate(false); // Exit edit mode after generating
            if (!explicitTemplateId) success('Proposal generated and saved');
            loadEstimate(true); // Reload to get snapshot info
        } else {
            toastError('Failed to generate proposal');
        }
        setGeneratingProposal(false);
    };

    const handleHeaderUpdate = async (field: string, value: string | number | boolean) => {
        if (!formData) return;
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
        setUnsavedChanges(true);

        // Auto-populate logic when Customer changes
        if (field === 'customerId' && value) {
            try {
                // Fetch Client Details (has both addresses and contacts now)
                const clientRes = await apiCall('getClientById', { id: value });
                if (clientRes.success && clientRes.result) {
                    const client = clientRes.result;

                    const firstAddress = client.addresses?.[0] || client.businessAddress || '';
                    const firstContact = client.contacts?.[0] || { name: client.contactFullName, email: client.email, phone: client.phone };

                    setFormData(prev => prev ? {
                        ...prev,
                        jobAddress: firstAddress,
                        contactName: firstContact.name || '',
                        contactId: firstContact.name || '',
                        contactEmail: firstContact.email || '',
                        contactPhone: firstContact.phone || ''
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
                miscellaneous: estimate.miscellaneous
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

    const handleClone = async (id?: string) => {
        setLoading(true);
        try {
            const result = await apiCall('cloneEstimate', { id: id || estimate?._id });
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
            case 'Tools': return toolsCatalog;
            case 'Miscellaneous': return miscellaneousCatalog;
            default: return [];
        }
    };
    
    const handleAddClient = async (name: string) => {
        try {
            const res = await apiCall('addClient', { item: { name, status: 'Active' } });
            if (res.success && res.result) {
                const newClient = res.result;
                const opt = {
                    id: newClient._id || newClient.recordId,
                    label: newClient.name,
                    value: newClient._id || newClient.recordId
                };
                setClientOptions(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)));
                success('Client added');
                return { id: opt.id, name: opt.label };
            }
        } catch (e) {
            console.error(e);
            toastError('Error adding client');
        }
        return null;
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
            const res = await apiCall('updateClient', { id: formData.customerId, item: { addresses: updatedAddresses } });
            if (res.success) {
                success('Client addresses updated');
                setAddressOptions(updatedAddresses.map(a => ({ id: a, label: a, value: a })));
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
            <div className="flex flex-col h-full bg-[#f8fafc]">
                <div className="flex-none">
                    <Header />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="w-full px-4 md:px-6 py-6">
                        <SkeletonEstimateHeader />
                    </div>
                    <div className="w-full space-y-4 pb-20 px-4 md:px-6">
                        <SkeletonAccordion />
                        <SkeletonAccordion />
                        <SkeletonAccordion />
                    </div>
                </div>
            </div>
        );
    }

    // Empty state
    if (!estimate || !formData) {
        return (
            <div className="flex flex-col h-full bg-[#f8fafc]">
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
        <div className="flex flex-col h-full min-h-0 bg-[#f8fafc]">
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
                        <button
                            onClick={handleToggleAll}
                            className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={allExpanded ? "Collapse All" : "Expand All"}
                        >
                            {allExpanded ? <ChevronsUp className="w-5 h-5" /> : <ChevronsDown className="w-5 h-5" />}
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        {/* Refresh */}
                        {/* Back */}
                        <button
                            onClick={() => router.push('/estimates')}
                            className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Back to Estimates"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>



                        {/* Copy */}
                        <button
                            onClick={handleCopy}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                            title="Copy to New Estimate"
                        >
                            <Copy className="w-5 h-5" />
                        </button>


                        {/* More Details */}
                        <button
                            onClick={() => setIsDetailsModalOpen(true)}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-[#0F4C75] hover:bg-blue-50 rounded-xl transition-colors"
                            title="More Details"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
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
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 w-full bg-[#F4F7FA]">
                <div className="w-full px-4 md:px-6 py-6">
                    {/* Header Card */}
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

                        onVersionClick={(id) => {
                            const v = versionHistory.find(vh => vh._id === id);
                            if (v) {
                                const slug = v.estimate ? `${v.estimate}-V${v.versionNumber || 1}` : v._id;
                                router.push(`/estimates/${slug}`);
                            }
                        }}
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
                            grandTotal={chartData.subTotal}
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-20 shadow-sm rounded-t-xl transition-all">
                                <div className="flex items-center gap-2">
                                    <LayoutTemplate className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-gray-800">Proposal</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <TemplateSelector
                                        templates={templates}
                                        selectedId={selectedTemplateId}
                                        onSelect={(newId) => {
                                            setSelectedTemplateId(newId);
                                            if (newId) {
                                                handleGenerateProposal(newId);
                                            } else {
                                                setPreviewHtml('');
                                            }
                                        }}
                                        disabled={isEditingTemplate}
                                    />
                                    
                                    {!isEditingTemplate && (
                                        <Button
                                            onClick={async () => {
                                                await handlePreview(false);
                                                setShowPdfPreview(true);
                                            }}
                                            variant="secondary"
                                            size="sm"
                                            disabled={generatingProposal || !selectedTemplateId}
                                        >
                                            {generatingProposal ? 'Generating...' : 'Preview PDF'}
                                        </Button>
                                    )}

                                    {(previewHtml || estimate?.proposal?.htmlContent) && (
                                        <>
                                            {isEditingTemplate ? (
                                                <>
                                                    <Button
                                                        onClick={() => {
                                                            setIsEditingTemplate(false);
                                                            handlePreview(false);
                                                        }}
                                                        variant="ghost"
                                                        size="sm"
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setSaveType('create');
                                                            const currentTitle = templates.find(t => t._id === selectedTemplateId)?.title;
                                                            setNewTemplateTitle(currentTitle ? `${currentTitle} (Copy)` : 'New Template');
                                                            setShowSaveTemplateModal(true);
                                                        }}
                                                        variant="secondary"
                                                        size="sm"
                                                    >
                                                        Save Copy
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setSaveType('update');
                                                            handleSaveTemplate();
                                                        }}
                                                        variant="primary"
                                                        size="sm"
                                                        disabled={isSavingTemplate}
                                                    >
                                                        {isSavingTemplate ? 'Saving...' : 'Save Changes'}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    onClick={() => {
                                                        const tmpl = templates.find(t => t._id === selectedTemplateId);
                                                        // Load pages if available, otherwise fallback to content or empty
                                                        if (tmpl?.pages && tmpl.pages.length > 0) {
                                                            setEditorPages(tmpl.pages);
                                                        } else {
                                                            setEditorPages([{ content: tmpl?.content || '' }]);
                                                        }
                                                        setIsEditingTemplate(true);
                                                    }}
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={generatingProposal}
                                                >
                                                    Edit Template
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {(previewHtml || (estimate?.proposal?.htmlContent)) ? (
                                <div className="p-8 bg-gray-50 min-h-[400px] ql-snow rounded-b-xl">
                                    {isEditingTemplate ? (
                                        <div className="flex bg-[#e0e5ec] min-h-[800px] -m-8">
                                            {/* Main Editor - Using shared LetterPageEditor */}
                                            <div className="flex-1 overflow-y-auto py-8 px-12">
                                                <LetterPageEditor
                                                    pages={editorPages}
                                                    onPagesChange={setEditorPages}
                                                    quillRefs={quillRefs}
                                                    showAddPage={true}
                                                    showDeletePage={true}
                                                />
                                            </div>

                                            {/* Variables Sidebar */}
                                            <div className="w-80 flex-shrink-0 p-6 sticky top-0 h-[calc(100vh-200px)] overflow-y-auto">
                                                <div className="mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Insert Variables</div>
                                                
                                                <SidebarAccordion title="System Variables" defaultOpen={true}>
                                                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                                                        {SYSTEM_VARIABLES.map(v => (
                                                            <button 
                                                                key={v.name}
                                                                onClick={() => insertVariable(v.name)}
                                                                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-blue-600 hover:bg-white/50 transition-all flex items-center justify-between group"
                                                            >
                                                                <span className="truncate">{v.label}</span>
                                                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </SidebarAccordion>

                                                <SidebarAccordion title="Custom Variables" defaultOpen={true}>
                                                    <div className="space-y-1.5">
                                                        {CUSTOM_VARIABLES.map(v => (
                                                            <button 
                                                                key={v.name}
                                                                onClick={() => insertVariable(v.name)}
                                                                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-blue-600 hover:bg-white/50 transition-all flex items-center justify-between group"
                                                            >
                                                                <span>{v.label}</span>
                                                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </SidebarAccordion>

                                                <SidebarAccordion title="Line Item Variables" defaultOpen={false}>
                                                    <div className="space-y-1.5">
                                                        {LINE_ITEM_VARIABLES.map(v => (
                                                            <button 
                                                                key={v.name}
                                                                onClick={() => insertVariable(v.name)}
                                                                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-blue-600 hover:bg-white/50 transition-all flex items-center justify-between group"
                                                            >
                                                                <div className="flex flex-col items-start gap-1">
                                                                    <span>{v.label}</span>
                                                                    <span className="text-[10px] text-gray-400 font-normal">{v.description}</span>
                                                                </div>
                                                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </SidebarAccordion>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-8 items-center w-full">
                                            {(() => {
                                                const rawHtml = previewHtml || estimate?.proposal?.htmlContent || '';
                                                const pageContentArray = rawHtml
                                                    .split('___PAGE_BREAK___')
                                                    .flatMap(p => p.split(/(?:<!-- PAGEBREAK -->|<div style="page-break-after: always;[^"]*"><\/div>)/));

                                                return pageContentArray.map((pageHtml, idx) => (
                                                    <div key={idx} className="flex flex-col items-center w-full">
                                                        {/* Page number indicator */}
                                                        <div className="w-[8.5in] flex items-center justify-between py-3 select-none">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">Page {idx + 1}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400">Letter Size (8.5" × 11")</span>
                                                        </div>
                                                        {/* Letter page container - exact printable area */}
                                                        <div
                                                            className="bg-white shadow-lg mx-auto relative"
                                                            style={{
                                                                width: '8.5in',
                                                                height: '11in',
                                                                minWidth: '8.5in',
                                                                minHeight: '11in',
                                                                padding: '0',
                                                                fontFamily: 'Arial, sans-serif',
                                                                fontSize: '11pt',
                                                                lineHeight: '1.15',
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
                                    )}
                                </div>
                            ) : (
                                <div className="p-12 flex flex-col items-center justify-center text-center text-gray-400 bg-gray-50 min-h-[400px] rounded-b-xl">
                                    <div className="relative mb-6 group">
                                        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20 duration-1000"></div>
                                        <div className="relative bg-white p-4 rounded-full shadow-sm border border-gray-100">
                                            <FileText className="w-12 h-12 text-blue-200 animate-pulse" />
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full border-2 border-white animate-bounce"></div>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Missing Proposal</h3>
                                    <p className="text-sm max-w-sm mx-auto text-gray-500">
                                        Select a template from the dropdown above to generate a professional proposal instantly.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
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
                                    onClick={async () => {
                                        try {
                                            // Get the HTML content for PDF
                                            const content = (previewHtml || estimate?.proposal?.htmlContent || '')

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
                        <div id="pdf-preview-content" className="flex-1 overflow-auto p-8 bg-gray-100 flex flex-col gap-8 items-center cursor-default relative">
                            {generatingProposal && (
                                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                </div>
                            )}
                            {(() => {
                                const rawHtml = previewHtml || estimate?.proposal?.htmlContent || '';
                                // Robust split: First by the explicit new text marker, then by legacy markers
                                const pageContentArray = rawHtml
                                    .split('___PAGE_BREAK___')
                                    .flatMap(p => p.split(/(?:<!-- PAGEBREAK -->|<div style="page-break-after: always;[^"]*"><\/div>)/));

                                return pageContentArray.map((pageHtml, idx) => (
                                    <div key={idx} className="flex flex-col items-center w-full">
                                        {/* Page number indicator */}
                                        <div className="w-[8.5in] flex items-center justify-between py-3 select-none">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">Page {idx + 1}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400">Letter Size (8.5" × 11")</span>
                                        </div>
                                        {/* Letter page container - exact printable area */}
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
                            onClick={handleSaveTemplate}
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
        </div>
    );
}
