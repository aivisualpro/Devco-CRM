'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import {
    Plus, Trash2, DollarSign, Calendar, Loader2, Search,
    AlertTriangle, X, ChevronDown
} from 'lucide-react';

interface FringeCostRecord {
    _id: string;
    type: string;
    fromDate: string;
    toDate: string;
    cost: number;
    createdAt: string;
}

export default function FringeCostsSettings() {
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
    const [records, setRecords] = useState<FringeCostRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [formType, setFormType] = useState('HDD Private');
    const [formFrom, setFormFrom] = useState('');
    const [formTo, setFormTo] = useState('');
    const [formCost, setFormCost] = useState('');

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/fringe-costs');
            const data = await res.json();
            if (data.success) {
                setRecords(data.result);
            }
        } catch (err) {
            toastError('Failed to load fringe costs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRecords(); }, []);

    const handleCreate = async () => {
        if (!formFrom || !formTo || !formCost) {
            toastWarning('Please fill in all fields');
            return;
        }

        if (new Date(formFrom) >= new Date(formTo)) {
            toastWarning('From date must be before To date');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/fringe-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    payload: {
                        type: formType,
                        fromDate: formFrom,
                        toDate: formTo,
                        cost: formCost
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toastSuccess('Fringe cost added successfully');
                setRecords(prev => [data.result, ...prev]);
                resetForm();
            } else if (data.overlap) {
                toastWarning('Date range already selected', data.error);
            } else {
                toastError(data.error || 'Failed to add fringe cost');
            }
        } catch (err) {
            toastError('Error creating fringe cost');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch('/api/fringe-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', payload: { _id: id } })
            });
            const data = await res.json();
            if (data.success) {
                setRecords(prev => prev.filter(r => r._id !== id));
                toastSuccess('Fringe cost deleted');
                setDeleteId(null);
            } else {
                toastError('Failed to delete');
            }
        } catch (err) {
            toastError('Error deleting fringe cost');
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setFormType('HDD Private');
        setFormFrom('');
        setFormTo('');
        setFormCost('');
    };

    const filteredRecords = useMemo(() => {
        if (!searchQuery) return records;
        const q = searchQuery.toLowerCase();
        return records.filter(r =>
            r.type.toLowerCase().includes(q) ||
            r.cost.toString().includes(q)
        );
    }, [records, searchQuery]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    };

    const getTypeColor = (type: string) => {
        if (type === 'HDD Private') return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' };
        return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' };
    };

    return (
        <div className="flex flex-col h-full bg-[#f4f7fa]">
            <Header
                hideLogo={false}
                rightContent={
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/15 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        <Plus size={16} />
                        Add Fringe Cost
                    </button>
                }
            />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-6">

                    {/* Page Title */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fringe Costs</h1>
                            <p className="text-sm text-slate-500 mt-1">Manage HDD cost rates by date range</p>
                        </div>
                        <div className="relative w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search costs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] shadow-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                                    <DollarSign size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</p>
                                    <p className="text-xl font-black text-slate-900">{records.length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white shadow-sm">
                                    <span className="text-xs font-black">Pvt</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HDD Private</p>
                                    <p className="text-xl font-black text-slate-900">{records.filter(r => r.type === 'HDD Private').length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white shadow-sm">
                                    <span className="text-xs font-black">Pub</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HDD Public</p>
                                    <p className="text-xl font-black text-slate-900">{records.filter(r => r.type === 'HDD Public').length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30">
                            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Cost Records</h2>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                                    <DollarSign size={24} className="text-slate-200" />
                                </div>
                                <p className="text-sm font-bold text-slate-400">No fringe costs found</p>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#0F4C75] text-white rounded-xl text-xs font-bold hover:bg-[#3282B8] transition-all"
                                >
                                    <Plus size={14} /> Add First Cost
                                </button>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Type</th>
                                        <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">From</th>
                                        <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">To</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Cost / Hr</th>
                                        <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] w-20">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((record) => {
                                        const colors = getTypeColor(record.type);
                                        return (
                                            <tr key={record._id} className="border-b border-slate-50/50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${colors.bg} ${colors.text} ${colors.border} border`}>
                                                            {record.type}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={12} className="text-slate-300" />
                                                        <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatDate(record.fromDate)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={12} className="text-slate-300" />
                                                        <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatDate(record.toDate)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-black text-emerald-600 tabular-nums">
                                                        ${record.cost.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {deleteId === record._id ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleDelete(record._id)}
                                                                className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-[10px] font-bold hover:bg-red-600 transition-all"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteId(null)}
                                                                className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteId(record._id)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>

            {/* Add Fringe Cost Modal */}
            {showForm && (
                <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => resetForm()}>
                    <div
                        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-[#0F4C75] to-[#3282B8] text-white shadow-sm">
                                    <DollarSign size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">Add Fringe Cost</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define new cost rate</p>
                                </div>
                            </div>
                            <button onClick={() => resetForm()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Date Range - Side by Side */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Date From</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="date"
                                            value={formFrom}
                                            onChange={(e) => setFormFrom(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Date To</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="date"
                                            value={formTo}
                                            onChange={(e) => setFormTo(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Cost Fields - Side by Side */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">HDD Private</label>
                                    <div className="relative">
                                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formType === 'HDD Private' ? formCost : ''}
                                            onChange={(e) => {
                                                setFormType('HDD Private');
                                                setFormCost(e.target.value);
                                            }}
                                            onFocus={() => {
                                                if (formType !== 'HDD Private') {
                                                    setFormType('HDD Private');
                                                    setFormCost('');
                                                }
                                            }}
                                            className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all ${formType === 'HDD Private' ? 'bg-violet-50 border-violet-200 text-violet-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">HDD Public</label>
                                    <div className="relative">
                                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formType === 'HDD Public' ? formCost : ''}
                                            onChange={(e) => {
                                                setFormType('HDD Public');
                                                setFormCost(e.target.value);
                                            }}
                                            onFocus={() => {
                                                if (formType !== 'HDD Public') {
                                                    setFormType('HDD Public');
                                                    setFormCost('');
                                                }
                                            }}
                                            className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all ${formType === 'HDD Public' ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Selected Type Indicator */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                <div className={`w-2 h-2 rounded-full ${formType === 'HDD Private' ? 'bg-violet-500' : 'bg-cyan-500'}`} />
                                <span className="text-xs font-bold text-slate-500">
                                    Selected: <span className={formType === 'HDD Private' ? 'text-violet-600' : 'text-cyan-600'}>{formType}</span>
                                    {formCost && <span className="ml-2 text-emerald-600">(${parseFloat(formCost || '0').toFixed(2)} / hr)</span>}
                                </span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                            <button
                                onClick={() => resetForm()}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={saving || !formFrom || !formTo || !formCost}
                                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/15 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Save Cost
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
