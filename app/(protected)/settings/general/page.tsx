'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save, MessageSquare, FileText, ToggleLeft, ToggleRight, Variable, Info, ChevronDown, Sparkles } from 'lucide-react';
import { Header } from '@/components/ui';

/* ─── Types ─── */
interface ConstantItem {
    _id: string;
    type: string;
    value: string;
    templateId?: string;
    description?: string;
}

interface CustomizationItem {
    _id: string;
    key: string;
    label: string;
    category: string;
    template: string;
    enabled: boolean;
    variables: string[];
}

/* ─── Variable Chip Component ─── */
function VariableChip({ name, onClick }: { name: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-violet-50 to-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-lg text-xs font-mono font-bold 
                       hover:from-violet-100 hover:to-indigo-100 hover:border-indigo-300 hover:shadow-sm
                       active:scale-95 transition-all cursor-pointer select-none group"
            title={`Click to insert {{${name}}}`}
        >
            <span className="text-indigo-400 group-hover:text-indigo-500 transition-colors">{'{{'}</span>
            <span>{name}</span>
            <span className="text-indigo-400 group-hover:text-indigo-500 transition-colors">{'}}'}</span>
        </button>
    );
}

/* ─── SMS Template Editor ─── */
function TemplateEditor({ item, onSave }: { item: CustomizationItem; onSave: (updated: CustomizationItem) => void }) {
    const [template, setTemplate] = useState(item.template);
    const [enabled, setEnabled] = useState(item.enabled);
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Keep in sync with parent
    useEffect(() => {
        setTemplate(item.template);
        setEnabled(item.enabled);
    }, [item]);

    const insertVariable = useCallback((varName: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = template;
        const insertion = `{{${varName}}}`;
        const newText = text.substring(0, start) + insertion + text.substring(end);
        setTemplate(newText);

        // Restore cursor position after insertion
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        }, 0);
    }, [template]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/customizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    payload: { _id: item._id, template, enabled }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Template saved');
                onSave({ ...item, template, enabled });
            } else {
                toast.error('Failed to save');
            }
        } catch {
            toast.error('Error saving template');
        } finally {
            setSaving(false);
        }
    };

    // Highlight {{variables}} in preview
    const renderPreview = () => {
        if (!template) return <span className="text-slate-400 italic">No template defined</span>;
        const parts = template.split(/(\{\{\w+\}\})/g);
        return parts.map((part, i) => {
            if (/^\{\{\w+\}\}$/.test(part)) {
                const varName = part.replace(/[{}]/g, '');
                return (
                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-indigo-100 text-indigo-700 rounded font-mono text-[11px] font-bold border border-indigo-200/50">
                        {varName}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    const categoryIcon = item.category === 'sms' ? (
        <MessageSquare className="w-4 h-4" />
    ) : (
        <FileText className="w-4 h-4" />
    );

    const categoryLabel = item.category === 'sms' ? 'SMS' : item.category === 'email' ? 'Email' : item.category;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                        {categoryIcon}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800">{item.label}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{categoryLabel} Template</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Enable/Disable Toggle */}
                    <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${enabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                            }`}
                    >
                        {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {enabled ? 'Enabled' : 'Disabled'}
                    </button>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* Available Variables */}
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Available Variables</span>
                        <span className="text-[10px] text-slate-400 italic ml-1">(click to insert)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {item.variables.map((v) => (
                            <VariableChip key={v} name={v} onClick={() => insertVariable(v)} />
                        ))}
                    </div>
                </div>

                {/* Template Editor */}
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Message Template</label>
                    <textarea
                        ref={textareaRef}
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-mono leading-relaxed
                                   focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all 
                                   resize-y placeholder:text-slate-400"
                        placeholder="Type your message template here... Use {{variableName}} for dynamic content."
                    />
                </div>

                {/* Live Preview */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Preview</span>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed min-h-[60px]">
                        {renderPreview()}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function GeneralSettings() {
    const [activeTab, setActiveTab] = useState('docIds');
    const [constants, setConstants] = useState<ConstantItem[]>([]);
    const [customizations, setCustomizations] = useState<CustomizationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [custLoading, setCustLoading] = useState(false);

    // Types to manage
    const DOC_TYPES = ['Releases', 'Prelims', 'Certified Payroll Reports'];

    const fetchConstants = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/constants?types=${DOC_TYPES.join(',')}`);
            const data = await res.json();
            if (data.success) {
                const mapped = data.result.map((item: any) => ({
                    ...item,
                    value: item.value || item.description || ''
                }));
                setConstants(mapped);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomizations = async () => {
        setCustLoading(true);
        try {
            const res = await fetch('/api/customizations');
            const data = await res.json();
            if (data.success) {
                setCustomizations(data.result);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load customizations');
        } finally {
            setCustLoading(false);
        }
    };

    useEffect(() => {
        fetchConstants();
    }, []);

    // Lazy-load customizations when tab is activated
    useEffect(() => {
        if (activeTab === 'customizations' && customizations.length === 0) {
            fetchCustomizations();
        }
    }, [activeTab]);

    const handleChange = (id: string, field: keyof ConstantItem, value: string) => {
        setConstants(prev => prev.map(c => c._id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = async (item: ConstantItem) => {
        try {
            const res = await fetch('/api/constants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    payload: item
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Saved');
            } else {
                toast.error('Failed to save');
            }
        } catch (e) {
            toast.error('Error saving');
        }
    };

    const handleAddItem = async (type: string) => {
        const newItem = {
            type,
            value: 'New Document',
            templateId: ''
        };
        try {
            const res = await fetch('/api/constants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    payload: newItem
                })
            });
            const data = await res.json();
            if (data.success) {
                setConstants(prev => [...prev, data.result]);
                toast.success('Added new item');
            }
        } catch (e) {
            toast.error('Error adding item');
        }
    };

    const handleCustomizationSave = (updated: CustomizationItem) => {
        setCustomizations(prev => prev.map(c => c._id === updated._id ? updated : c));
    };

    const tabs = [
        { id: 'docIds', label: 'Estimate Document Ids', icon: <FileText className="w-3.5 h-3.5" /> },
        { id: 'customizations', label: 'Customizations', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header hideLogo={false} />
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-slate-200">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm transition-all ${
                                    activeTab === tab.id 
                                    ? 'text-[#0F4C75] border-b-2 border-[#0F4C75]' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ─── Tab: Document IDs ─── */}
                    {activeTab === 'docIds' && (
                        loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-12 pb-20">
                                {DOC_TYPES.map(type => (
                                    <div key={type} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-xl font-black text-slate-700">{type}</h2>
                                            <button
                                                onClick={() => handleAddItem(type)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add {type.slice(0, -1)}
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <table className="w-full text-left table-fixed">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Name</th>
                                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Google Doc Template ID</th>
                                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-right"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {constants.filter(c => c.type === type).length > 0 ? (
                                                        constants.filter(c => c.type === type).map(item => (
                                                            <tr key={item._id} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-6 py-3">
                                                                    <input 
                                                                        type="text" 
                                                                        value={item.value}
                                                                        placeholder="Document Name"
                                                                        onChange={(e) => handleChange(item._id, 'value', e.target.value)}
                                                                        className="w-full bg-transparent font-bold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 -ml-2 transition-all placeholder:text-slate-300"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <input 
                                                                        type="text" 
                                                                        value={item.templateId || ''}
                                                                        placeholder="Enter Google Doc ID..."
                                                                        onChange={(e) => handleChange(item._id, 'templateId', e.target.value)}
                                                                        className="w-full bg-transparent font-mono text-xs text-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 -ml-2 transition-all"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3 text-right">
                                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button 
                                                                            onClick={() => handleSave(item)}
                                                                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                            title="Save"
                                                                        >
                                                                            <Save className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-sm font-medium italic">
                                                                No documents found. Add a new one to get started.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* ─── Tab: Customizations ─── */}
                    {activeTab === 'customizations' && (
                        custLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-6 pb-20">
                                {/* Description */}
                                <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 rounded-xl border border-indigo-100/50">
                                    <Info className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Notification Templates</p>
                                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            Customize the messages sent to employees via SMS. Click on any variable chip to insert it into your template. 
                                            Variables will be replaced with actual values when the notification is sent.
                                        </p>
                                    </div>
                                </div>

                                {/* Template editors */}
                                {customizations.length > 0 ? (
                                    customizations.map(item => (
                                        <TemplateEditor
                                            key={item._id}
                                            item={item}
                                            onSave={handleCustomizationSave}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-16">
                                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400 font-medium">No customizations found.</p>
                                        <p className="text-xs text-slate-300 mt-1">They will be created automatically when you first use the SMS feature.</p>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
