'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from '@/components/ui';
import { Plus, Settings, Trash2, GripVertical, Eye, EyeOff, Edit, X, BarChart3, TrendingUp, PieChart, Activity, Maximize2, Minimize2, ExternalLink, Loader2, LayoutGrid } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';

interface ChartConfig {
    _id: string;
    title: string;
    description: string;
    embedUrl: string;
    size: 'small' | 'medium' | 'large';
    height: number;
    order: number;
    active: boolean;
    category: string;
    createdBy: string;
}

const SIZE_OPTIONS = [
    { value: 'small', label: 'Small (1 col)', icon: '▪' },
    { value: 'medium', label: 'Medium (2 col)', icon: '▬' },
    { value: 'large', label: 'Large (Full)', icon: '█' },
];

const CATEGORY_PRESETS = ['General', 'Financial', 'Operations', 'HR & Payroll', 'Projects', 'Custom'];

export default function ChartsPage() {
    const { success, error: toastError } = useToast();
    const { isSuperAdmin } = usePermissions();
    const [charts, setCharts] = useState<ChartConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [expandedChart, setExpandedChart] = useState<string | null>(null);

    // Add/Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
    const [form, setForm] = useState<{
        title: string; description: string; embedUrl: string; size: 'small' | 'medium' | 'large';
        height: number; category: string; active: boolean;
    }>({
        title: '', description: '', embedUrl: '', size: 'medium',
        height: 400, category: 'General', active: true
    });
    const [saving, setSaving] = useState(false);

    const fetchCharts = useCallback(async () => {
        try {
            const res = await fetch('/api/charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: isAdminMode ? 'getAll' : 'getAll' })
            });
            const data = await res.json();
            if (data.success) setCharts(data.charts || []);
        } catch (err) {
            console.error('Error fetching charts:', err);
        } finally {
            setLoading(false);
        }
    }, [isAdminMode]);

    useEffect(() => { fetchCharts(); }, [fetchCharts]);

    const categories = ['All', ...Array.from(new Set(charts.map(c => c.category).filter(Boolean)))];
    const visibleCharts = charts.filter(c => {
        if (!isAdminMode && !c.active) return false;
        if (activeCategory !== 'All' && c.category !== activeCategory) return false;
        return true;
    });

    const openAddModal = () => {
        setEditingChart(null);
        setForm({ title: '', description: '', embedUrl: '', size: 'medium', height: 400, category: 'General', active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (chart: ChartConfig) => {
        setEditingChart(chart);
        setForm({
            title: chart.title, description: chart.description, embedUrl: chart.embedUrl,
            size: chart.size, height: chart.height, category: chart.category, active: chart.active
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.embedUrl.trim()) {
            toastError('Title and Embed URL are required');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: editingChart ? 'update' : 'create',
                    payload: editingChart ? { id: editingChart._id, ...form } : { ...form, order: charts.length }
                })
            });
            const data = await res.json();
            if (data.success) {
                success(editingChart ? 'Chart updated' : 'Chart added');
                setIsModalOpen(false);
                fetchCharts();
            } else {
                toastError(data.error || 'Failed to save');
            }
        } catch {
            toastError('Failed to save chart');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this chart?')) return;
        try {
            const res = await fetch('/api/charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', payload: { id } })
            });
            const data = await res.json();
            if (data.success) {
                success('Chart removed');
                fetchCharts();
            }
        } catch {
            toastError('Failed to delete');
        }
    };

    const handleToggleActive = async (chart: ChartConfig) => {
        try {
            await fetch('/api/charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', payload: { id: chart._id, active: !chart.active } })
            });
            fetchCharts();
        } catch {
            toastError('Failed to update');
        }
    };

    const getGridClass = (size: string) => {
        switch (size) {
            case 'small': return 'col-span-1';
            case 'medium': return 'col-span-1 lg:col-span-2';
            case 'large': return 'col-span-1 lg:col-span-3';
            default: return 'col-span-1 lg:col-span-2';
        }
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'Financial': return <TrendingUp size={14} />;
            case 'Operations': return <Activity size={14} />;
            case 'HR & Payroll': return <PieChart size={14} />;
            default: return <BarChart3 size={14} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header
                hideLogo={false}
                rightContent={
                    <div className="flex items-center gap-3">
                        {isSuperAdmin && (
                            <>
                                <button
                                    onClick={() => setIsAdminMode(!isAdminMode)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${isAdminMode
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <Settings size={14} />
                                    {isAdminMode ? 'Admin Mode' : 'Manage'}
                                </button>
                                <button
                                    onClick={openAddModal}
                                    className="w-10 h-10 flex items-center justify-center bg-[#0F4C75] text-white rounded-xl shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all active:scale-95"
                                >
                                    <Plus size={20} />
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            <main className="flex-1 min-h-0 overflow-auto p-4 lg:p-6 max-w-[1920px] w-full mx-auto">
                {/* Category Tabs */}
                {categories.length > 2 && (
                    <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all whitespace-nowrap ${activeCategory === cat
                                        ? 'bg-[#0F4C75] text-white shadow-sm'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {cat !== 'All' && getCategoryIcon(cat)}
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Charts Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`${i <= 2 ? 'lg:col-span-2' : 'lg:col-span-1'} bg-white rounded-2xl border border-slate-100 animate-pulse`}>
                                <div className="h-10 bg-slate-50 rounded-t-2xl" />
                                <div className="h-[350px]" />
                            </div>
                        ))}
                    </div>
                ) : visibleCharts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                            <BarChart3 size={36} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-400">No Charts Yet</h3>
                        <p className="text-sm text-slate-400 text-center max-w-md">
                            Add your first MongoDB Atlas Chart to start building your analytics dashboard.
                            Go to Atlas → Charts → Create a chart → Embed → Copy the iframe URL.
                        </p>
                        {isSuperAdmin && (
                            <button
                                onClick={openAddModal}
                                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#0F4C75] text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all active:scale-95"
                            >
                                <Plus size={18} />
                                Add Chart
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {visibleCharts.map(chart => {
                            const isExpanded = expandedChart === chart._id;
                            return (
                                <div
                                    key={chart._id}
                                    className={`${isExpanded ? 'lg:col-span-3' : getGridClass(chart.size)} bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all group ${!chart.active ? 'opacity-50 border-dashed border-amber-300' : ''}`}
                                >
                                    {/* Chart Header */}
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {isAdminMode && (
                                                <GripVertical size={14} className="text-slate-300 cursor-grab shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black text-slate-700 truncate">{chart.title}</h3>
                                                {chart.description && (
                                                    <p className="text-[10px] text-slate-400 truncate">{chart.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                                onClick={() => setExpandedChart(isExpanded ? null : chart._id)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                                                title={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                            </button>
                                            {isAdminMode && (
                                                <>
                                                    <button
                                                        onClick={() => handleToggleActive(chart)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                                                        title={chart.active ? 'Hide' : 'Show'}
                                                    >
                                                        {chart.active ? <Eye size={13} /> : <EyeOff size={13} />}
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(chart)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(chart._id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Chart iframe */}
                                    <div style={{ height: isExpanded ? '70vh' : `${chart.height}px` }} className="w-full transition-all">
                                        <iframe
                                            src={chart.embedUrl}
                                            width="100%"
                                            height="100%"
                                            style={{ border: 'none', background: '#fff' }}
                                            allowFullScreen
                                            loading="lazy"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#0F4C75] flex items-center justify-center">
                                    <BarChart3 size={16} className="text-white" />
                                </div>
                                <h2 className="text-sm font-black text-slate-700">{editingChart ? 'Edit Chart' : 'Add Chart'}</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Title *</label>
                                <input
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Revenue by Month"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0F4C75]/30 focus:border-[#0F4C75] transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Atlas Charts Embed URL *</label>
                                <input
                                    value={form.embedUrl}
                                    onChange={e => setForm(p => ({ ...p, embedUrl: e.target.value }))}
                                    placeholder="https://charts.mongodb.com/charts-..."
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#0F4C75]/30 focus:border-[#0F4C75] transition-all"
                                />
                                <p className="mt-1 text-[10px] text-slate-400">
                                    Atlas → Charts → ··· → Embed Chart → Enable Unauthenticated → Copy iframe src URL
                                </p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                                <input
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Optional description"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0F4C75]/30 focus:border-[#0F4C75] transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Size</label>
                                    <div className="flex gap-1.5">
                                        {SIZE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setForm(p => ({ ...p, size: opt.value as any }))}
                                                className={`flex-1 px-2 py-2 rounded-lg text-[10px] font-bold transition-all ${form.size === opt.value
                                                        ? 'bg-[#0F4C75] text-white shadow-sm'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {opt.icon} {opt.label.split(' (')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Height (px)</label>
                                    <input
                                        type="number"
                                        value={form.height}
                                        onChange={e => setForm(p => ({ ...p, height: parseInt(e.target.value) || 400 }))}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0F4C75]/30 focus:border-[#0F4C75] transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {CATEGORY_PRESETS.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setForm(p => ({ ...p, category: cat }))}
                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${form.category === cat
                                                    ? 'bg-[#0F4C75] text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/30">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-[#0F4C75] text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all disabled:opacity-50"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                {editingChart ? 'Update' : 'Add Chart'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
