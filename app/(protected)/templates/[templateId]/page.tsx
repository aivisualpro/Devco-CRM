'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Plus, X, Save, ChevronDown, ChevronRight, ArrowLeft, FileText, Check, Loader2 } from 'lucide-react';
import { Header, ToastContainer, Badge, SearchInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import 'react-quill-new/dist/quill.snow.css';

// Dynamically import ReactQuill with custom size registration
const ReactQuill = dynamic(
    async () => {
        const mod = await import('react-quill-new');
        const Quill = (mod.default as any).Quill || (mod as any).Quill;
        if (Quill) {
            const Size = Quill.import('attributors/style/size') as any;
            Size.whitelist = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt'];
            Quill.register(Size, true);
        }
        return mod.default;
    },
    { ssr: false, loading: () => <div className="h-64 rounded-[20px] animate-pulse" style={{ background: '#e0e5ec', boxShadow: 'inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff' }} /> }
) as any;

interface CustomVariable {
    name: string;
    label: string;
    type: string;
    defaultValue?: string;
}

interface Template {
    _id: string;
    title: string;
    subTitle?: string;
    subTitleDescription?: string;
    content?: string;
    pages?: { content: string }[];
    customVariables?: CustomVariable[];
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}

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

// Fixed Custom Variables - these will show as fillable inputs in estimate proposals
const CUSTOM_VARIABLES = [
    { name: 'customText', label: 'Custom Text', type: 'text', description: 'Plain text field' },
    { name: 'customCurrency', label: 'Custom Currency', type: 'currency', description: 'Shows as $X,XXX.XX' },
    { name: 'customNumber', label: 'Custom Number', type: 'decimal', description: 'Shows as X,XXX.XX' },
];

// Line Item Variables - these become dropdowns to select items from estimate
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

export default function TemplateEditorPage() {
    const router = useRouter();
    const params = useParams();
    const templateId = params.templateId as string;
    const isNew = templateId === 'new';

    const { toasts, success, error: toastError, removeToast } = useToast();
    const quillRefs = useRef<any[]>([]);
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
    const savedTemplateIdRef = useRef<string | null>(isNew ? null : templateId);

    // State
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [formData, setFormData] = useState<Partial<Template>>({ title: '', subTitleDescription: '', status: 'draft' });
    const [pages, setPages] = useState<{ content: string }[]>([{ content: '' }]);

    const apiCall = async (action: string, payload: Record<string, unknown> = {}) => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, error: String(err) };
        }
    };

    useEffect(() => {
        if (!isNew) {
            fetchTemplate();
        }
    }, [isNew, templateId]);

    const fetchTemplate = async () => {
        setLoading(true);
        const result = await apiCall('getTemplates');
        if (result.success && result.result) {
            const template = result.result.find((t: Template) => t._id === templateId);
            if (template) {
                setFormData({ ...template });
                setPages(template.pages && template.pages.length > 0 ? template.pages : [{ content: template.content || '' }]);
                // Note: custom variables are loaded globally, not from template
            } else {
                toastError('Template not found');
                router.push('/templates');
            }
        } else {
            toastError('Failed to load template');
        }
        setLoading(false);
    };

    const handleBack = () => {
        router.push('/templates');
    };

    const handleSave = async () => {
        if (!formData.title) {
            toastError('Title is required');
            return;
        }
        setSaving(true);

        const dataToSave = {
            ...formData,
            pages: pages,
            content: pages[0]?.content || '',
            // Note: custom variables are saved globally, not per-template
        };

        const action = isNew ? 'addTemplate' : 'updateTemplate';
        const payload = isNew ? { item: dataToSave } : { id: templateId, item: dataToSave };

        const result = await apiCall(action, payload);
        setSaving(false);
        if (result.success) {
            setLastSaved(new Date());
            // If this was a new template, update the ref with the new ID
            if (isNew && result.result?._id) {
                savedTemplateIdRef.current = result.result._id;
            }
        } else {
            toastError('Failed to save template');
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (loading) return;

        // Clear existing timer
        if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
        }

        // Set new timer for auto-save (2 second debounce)
        autoSaveTimer.current = setTimeout(() => {
            if (formData.title) {
                // Auto-save silently
                const doAutoSave = async () => {
                    setSaving(true);
                    const dataToSave = {
                        ...formData,
                        pages: pages,
                        content: pages[0]?.content || '',
                    };

                    const currentId = savedTemplateIdRef.current;
                    const action = currentId ? 'updateTemplate' : 'addTemplate';
                    const payload = currentId ? { id: currentId, item: dataToSave } : { item: dataToSave };

                    const result = await apiCall(action, payload);
                    setSaving(false);
                    if (result.success) {
                        setLastSaved(new Date());
                        if (!currentId && result.result?._id) {
                            savedTemplateIdRef.current = result.result._id;
                        }
                    }
                };
                doAutoSave();
            }
        }, 2000);

        return () => {
            if (autoSaveTimer.current) {
                clearTimeout(autoSaveTimer.current);
            }
        };
    }, [formData, pages, loading]);

    // Page Logic
    const handleAddPage = () => {
        setPages([...pages, { content: '' }]);
    };

    const handleRemovePage = (index: number) => {
        if (pages.length <= 1) {
            toastError("Cannot delete the only page");
            return;
        }
        setPages(pages.filter((_, i) => i !== index));
    };

    const handlePageContentChange = (index: number, val: string) => {
        const newPages = [...pages];
        newPages[index] = { content: val };
        setPages(newPages);
        if (index === 0) {
            setFormData({ ...formData, content: val });
        }
    };

    // Editor Logic - insert into the last focused editor or first page
    const insertVariable = (variableName: string) => {
        // Try to find a focused editor
        for (const ref of quillRefs.current) {
            if (ref) {
                const editor = ref.getEditor();
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
            const editor = quillRefs.current[0].getEditor();
            const length = editor.getLength();
            editor.insertText(length - 1, `{{${variableName}}} `);
        }
    };

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            [{ 'size': ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
            ['link', 'image'],
            ['clean']
        ],
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-[#e0e5ec]">
                <div className="flex-none">
                    <Header />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: '#e0e5ec', boxShadow: '6px 6px 12px #b8b9be, -6px -6px 12px #ffffff' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#e0e5ec]">
            <div className="flex-none">
                <Header
                    rightContent={
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={String(formData.title || '')}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Untitled Template"
                                className="text-sm font-semibold text-gray-700 border-none focus:ring-0 p-0 placeholder-gray-400 bg-transparent w-48 text-right"
                            />
                            {saving ? (
                                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            ) : lastSaved ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : null}
                            <button
                                onClick={handleBack}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all active:scale-95 ml-2"
                                style={{ background: '#e0e5ec', boxShadow: '2px 2px 4px #b8b9be, -2px -2px 4px #ffffff' }}
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    }
                />
            </div>

            {/* Custom styles for Quill editor and toolbar */}
            <style jsx global>{`
                /* Size picker labels */
                .ql-snow .ql-picker.ql-size .ql-picker-label::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item::before {
                    content: '11pt';
                }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="8pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="8pt"]::before {
                    content: '8pt';
                }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="9pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="9pt"]::before {
                    content: '9pt';
                }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10pt"]::before {
                    content: '10pt';
                }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="11pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="11pt"]::before {
                    content: '11pt';
                }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12pt"]::before {
                    content: '12pt';
                }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="14pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="14pt"]::before {
                    content: '14pt';
                }
                
                /* Clean toolbar styling - bigger icons */
                .ql-toolbar.ql-snow {
                    background: #f8f9fa !important;
                    border-radius: 16px 16px 0 0 !important;
                    padding: 16px 20px !important;
                    border: none !important;
                    border-bottom: 1px solid #e5e7eb !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 8px !important;
                    align-items: center !important;
                }
                
                .ql-toolbar.ql-snow .ql-formats {
                    margin-right: 0 !important;
                    display: inline-flex !important;
                    gap: 6px !important;
                    align-items: center !important;
                }
                
                /* Make icons MUCH bigger */
                .ql-toolbar.ql-snow button {
                    width: 44px !important;
                    height: 44px !important;
                    padding: 10px !important;
                    border-radius: 10px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                .ql-toolbar.ql-snow button svg {
                    width: 24px !important;
                    height: 24px !important;
                }
                
                .ql-toolbar.ql-snow .ql-stroke {
                    stroke-width: 2px !important;
                }
                
                /* Picker styling - bigger */
                .ql-toolbar.ql-snow .ql-picker {
                    height: 44px !important;
                }
                
                .ql-toolbar.ql-snow .ql-picker-label {
                    padding: 10px 14px !important;
                    border-radius: 10px !important;
                    font-size: 15px !important;
                    font-weight: 500 !important;
                    display: flex !important;
                    align-items: center !important;
                    height: 44px !important;
                    border: 1px solid #e5e7eb !important;
                    background: white !important;
                }
                
                .ql-toolbar.ql-snow .ql-picker-label svg {
                    width: 16px !important;
                    height: 16px !important;
                }
                
                /* Hover states */
                .ql-toolbar.ql-snow button:hover {
                    background: #e5e7eb !important;
                }
                
                .ql-toolbar.ql-snow button.ql-active {
                    background: #dbeafe !important;
                    color: #2563eb !important;
                }
                
                .ql-toolbar.ql-snow button.ql-active .ql-stroke {
                    stroke: #2563eb !important;
                }
                
                .ql-toolbar.ql-snow button.ql-active .ql-fill {
                    fill: #2563eb !important;
                }
                
                /* Dropdown styling */
                .ql-toolbar.ql-snow .ql-picker-options {
                    background: white !important;
                    border-radius: 12px !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
                    padding: 8px !important;
                    border: 1px solid #e5e7eb !important;
                    margin-top: 4px !important;
                }
                
                .ql-toolbar.ql-snow .ql-picker-item {
                    padding: 10px 14px !important;
                    border-radius: 8px !important;
                    font-size: 14px !important;
                }
                
                .ql-toolbar.ql-snow .ql-picker-item:hover {
                    background: #f3f4f6 !important;
                }
                
                /* Editor content area - NO margins, user adds spacing */
                .ql-container.ql-snow .ql-editor {
                    padding: 0 !important;
                    font-size: 11pt !important;
                    line-height: 1.4 !important;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                    min-height: calc(11in - 50px) !important;
                    max-height: calc(11in - 50px) !important;
                    overflow: hidden !important;
                }
                
                /* Make bullets more visible */
                .ql-container.ql-snow .ql-editor ul,
                .ql-container.ql-snow .ql-editor ol {
                    padding-left: 1.5em !important;
                }
                
                .ql-container.ql-snow .ql-editor ul li::before {
                    content: '•' !important;
                    font-size: 1.2em !important;
                    font-weight: bold !important;
                    color: #374151 !important;
                    margin-right: 0.5em !important;
                }
                
                .ql-container.ql-snow .ql-editor ul li {
                    list-style-type: none !important;
                    padding-left: 0 !important;
                }
                
                /* Sticky toolbar */
                .ql-toolbar.ql-snow {
                    position: sticky !important;
                    top: 0 !important;
                    z-index: 10 !important;
                }
                
                /* Color picker - bigger swatches */
                .ql-color-picker .ql-picker-options,
                .ql-background .ql-picker-options {
                    padding: 10px !important;
                    width: auto !important;
                    display: none !important;
                }
                
                .ql-color-picker.ql-expanded .ql-picker-options,
                .ql-background.ql-expanded .ql-picker-options {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    max-width: 200px !important;
                }
                
                .ql-color-picker .ql-picker-item,
                .ql-background .ql-picker-item {
                    width: 28px !important;
                    height: 28px !important;
                    border-radius: 6px !important;
                    margin: 3px !important;
                }
                
                /* Color picker label styling - show the color indicator */
                .ql-toolbar.ql-snow .ql-color-picker .ql-picker-label,
                .ql-toolbar.ql-snow .ql-background .ql-picker-label {
                    padding: 0 !important;
                    width: 44px !important;
                    height: 44px !important;
                    border: 1px solid #e5e7eb !important;
                    border-radius: 10px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                .ql-toolbar.ql-snow .ql-color-picker .ql-picker-label svg,
                .ql-toolbar.ql-snow .ql-background .ql-picker-label svg {
                    width: 24px !important;
                    height: 24px !important;
                }
                
                /* Align picker styling */
                .ql-toolbar.ql-snow .ql-align .ql-picker-label {
                    padding: 0 !important;
                    width: 44px !important;
                    height: 44px !important;
                    border: 1px solid #e5e7eb !important;
                    border-radius: 10px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                .ql-toolbar.ql-snow .ql-align .ql-picker-label svg {
                    width: 24px !important;
                    height: 24px !important;
                }
                
                /* Hide alignment dropdown by default, show on hover/expanded */
                .ql-toolbar.ql-snow .ql-align .ql-picker-options {
                    display: none !important;
                    flex-direction: row !important;
                    padding: 8px !important;
                }
                
                .ql-toolbar.ql-snow .ql-align.ql-expanded .ql-picker-options {
                    display: flex !important;
                }
                
                .ql-toolbar.ql-snow .ql-align .ql-picker-item {
                    width: 36px !important;
                    height: 36px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 6px !important;
                }
            `}</style>

            <div className="flex-1 flex overflow-hidden min-h-0 bg-[#e0e5ec]">
                {/* CENTER: Pages (scrollable) */}
                <div className="flex-1 overflow-y-auto py-6 px-8">

                    {/* All Pages - Vertical Stack */}
                    <div className="flex flex-col gap-12 items-center origin-top-center pb-20" style={{ transform: 'scale(1.25)', transformOrigin: 'top center' }}>
                        {pages.map((page, index) => (
                            <div key={index} className="relative flex flex-col items-center">
                                {/* Page Indicator (Subtle) */}
                                <div className="absolute -left-12 top-2 select-none">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest vertical-text">
                                        P{index + 1}
                                    </span>
                                </div>

                                {index > 0 && (
                                    <button
                                        onClick={() => handleRemovePage(index)}
                                        className="absolute -right-10 top-2 p-2 text-gray-300 hover:text-red-500 transition-colors z-20"
                                        title="Delete Page"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}

                                {/* Page Container - Exact Letter Size */}
                                    <div
                                        className="bg-white relative flex-shrink-0 flex flex-col"
                                        style={{
                                            width: '8.5in',
                                            height: 'calc(11in + 38px)',
                                            minWidth: '8.5in',
                                            minHeight: 'calc(11in + 38px)',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.1), 0 1px 8px rgba(0,0,0,0.05)',
                                            borderRadius: '2px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <ReactQuill
                                            ref={(el: any) => { quillRefs.current[index] = el; }}
                                            theme="snow"
                                            value={page.content}
                                            onChange={(val: string) => handlePageContentChange(index, val)}
                                            modules={modules}
                                            className="h-full flex flex-col [&_.ql-container]:flex-1 [&_.ql-container]:border-none [&_.ql-container]:overflow-hidden [&_.ql-toolbar]:flex-shrink-0 [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-100"
                                            style={{ height: '100%' }}
                                        />
                                    </div>

                            </div>
                        ))}

                        {/* Add New Page Button */}
                        <button
                            onClick={handleAddPage}
                            className="mb-12 flex items-center gap-3 px-8 py-4 rounded-full text-gray-500 hover:text-blue-600 font-medium transition-all active:scale-[0.98]"
                            style={{ background: '#e0e5ec', boxShadow: '8px 8px 16px #b8b9be, -8px -8px 16px #ffffff' }}
                        >
                            <Plus className="w-5 h-5" />
                            <span>Add New Page</span>
                        </button>
                    </div>
                </div>

                {/* RIGHT SIDEBAR: Variables (Sticky) */}
                <div className="w-72 flex-shrink-0 p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
                    <SidebarAccordion title="System Variables" defaultOpen={true}>
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                            {SYSTEM_VARIABLES.map(v => (
                                <button
                                    key={v.name}
                                    onClick={() => insertVariable(v.name)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-blue-600 transition-all group flex items-center justify-between"
                                    style={{ background: '#e0e5ec', boxShadow: 'inset 2px 2px 4px #b8b9be, inset -2px -2px 4px #ffffff' }}
                                >
                                    <span className="font-medium truncate">{v.label}</span>
                                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 flex-shrink-0" />
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
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-blue-600 transition-all group"
                                    style={{ background: '#e0e5ec', boxShadow: 'inset 2px 2px 4px #b8b9be, inset -2px -2px 4px #ffffff' }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{v.label}</span>
                                        <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 flex-shrink-0" />
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{v.description}</div>
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
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-blue-600 transition-all group"
                                    style={{ background: '#e0e5ec', boxShadow: 'inset 2px 2px 4px #b8b9be, inset -2px -2px 4px #ffffff' }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{v.label}</span>
                                        <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 flex-shrink-0" />
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{v.description}</div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 p-2 rounded-lg text-[10px] text-gray-500 leading-relaxed" style={{ background: '#e0e5ec', boxShadow: 'inset 2px 2px 4px #b8b9be, inset -2px -2px 4px #ffffff' }}>
                            <strong>💡 Tip:</strong> In the proposal, these become dropdowns to select an item from that estimate category.
                        </div>
                    </SidebarAccordion>
                </div>
            </div>

            {/* Global styles for Quill paragraph spacing */}
            <style jsx global>{`
                .ql-editor p {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
                .ql-editor {
                    padding: 0 !important;
                    font-family: Arial, sans-serif !important;
                    line-height: 1.15 !important;
                }
                /* --- ULTRA-PREMIUM TOOLBAR --- */
                .ql-toolbar.ql-snow {
                    position: sticky !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    z-index: 100 !important;
                    background: #ffffff !important;
                    height: 44px !important; /* Fixed height for single row */
                    display: flex !important;
                    flex-wrap: nowrap !important; /* Force single row */
                    align-items: center !important;
                    padding: 0 8px !important;
                    border: none !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02) !important;
                    gap: 2px !important;
                    white-space: nowrap !important;
                }

                /* Hide Scrollbars */
                .ql-toolbar.ql-snow::-webkit-scrollbar { display: none; }
                
                /* Compact Groups */
                .ql-toolbar.ql-snow .ql-formats {
                    display: flex !important;
                    align-items: center !important;
                    margin-right: 8px !important;
                    padding-right: 8px !important;
                    border-right: 1px solid #f1f5f9 !important;
                    gap: 2px !important;
                }
                .ql-toolbar.ql-snow .ql-formats:last-child {
                    border-right: none !important;
                    margin-right: 0 !important;
                }

                /* Buttons */
                .ql-toolbar.ql-snow button {
                    width: 28px !important;
                    height: 28px !important;
                    padding: 4px !important;
                    border-radius: 4px !important;
                    color: #64748b !important;
                    transition: all 0.15s ease !important;
                }
                .ql-toolbar.ql-snow button:hover {
                    background-color: #f1f5f9 !important;
                    color: #0f172a !important;
                }
                .ql-toolbar.ql-snow button.ql-active {
                    background-color: #eff6ff !important;
                    color: #2563eb !important;
                }
                
                /* Icon SVG tweaks */
                .ql-toolbar.ql-snow .ql-stroke {
                    stroke-width: 2 !important;
                    stroke: currentColor !important;
                }
                .ql-toolbar.ql-snow .ql-fill {
                    fill: currentColor !important;
                }

                /* Compact Pickers (Dropdowns) */
                .ql-toolbar.ql-snow .ql-picker {
                    height: 28px !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .ql-toolbar.ql-snow .ql-picker-label {
                    padding: 0 8px !important;
                    border: 1px solid transparent !important;
                    border-radius: 4px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    color: #475569 !important;
                    height: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .ql-toolbar.ql-snow .ql-picker-label:hover {
                    background-color: #f8fafc !important;
                    border-color: #e2e8f0 !important;
                }
                
                /* Picker Widths */
                .ql-toolbar.ql-snow .ql-picker.ql-header { width: 85px !important; }
                .ql-toolbar.ql-snow .ql-picker.ql-size { width: 60px !important; }
                
                /* Editor Content */
                .ql-container.ql-snow {
                    border: none !important;
                    background: white !important;
                }
                /* Force Margin on Content */
                .ql-container.ql-snow .ql-editor {
                    padding: 48px !important; /* 0.5 inches */
                    width: 100% !important;
                    box-sizing: border-box !important;
                    font-family: Arial, sans-serif !important;
                    font-size: 11pt !important;
                    line-height: 1.15 !important;
                    min-height: 11in !important;
                    overflow-x: hidden !important;
                }

                /* Ensure tables and content respect the margin */
                .ql-editor > * {
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                .ql-editor table {
                    width: 100% !important;
                    max-width: 100% !important;
                    table-layout: fixed !important; /* Prevents cell expansion */
                }
                .ql-editor img {
                    max-width: 100% !important;
                    height: auto !important;
                }

                /* Table Cell Styling */
                .ql-editor td, .ql-editor th {
                    padding: 3px 6px !important;
                    border-color: #cbd5e1 !important;
                    word-wrap: break-word !important; /* Prevent text overflow */
                }

                /* Custom Font Sizes */
                .ql-editor .ql-size-8pt { font-size: 8pt !important; }
                .ql-editor .ql-size-9pt { font-size: 9pt !important; }
                .ql-editor .ql-size-10pt { font-size: 10pt !important; }
                /* 11pt is default, but explicit class helps */
                .ql-editor .ql-size-11pt { font-size: 11pt !important; } 
                .ql-editor .ql-size-12pt { font-size: 12pt !important; }
                .ql-editor .ql-size-14pt { font-size: 14pt !important; }
                
                /* Picker Label Overrides for Sizes */
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="8pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="8pt"]::before { content: '8pt'; }
                
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="9pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="9pt"]::before { content: '9pt'; }
                
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10pt"]::before { content: '10pt'; }
                
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="11pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="11pt"]::before { content: '11pt'; }
                
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12pt"]::before { content: '12pt'; }
                
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="14pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="14pt"]::before { content: '14pt'; }
            `}</style>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
