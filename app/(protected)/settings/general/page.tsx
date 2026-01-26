'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save } from 'lucide-react';
import { Header } from '@/components/ui';

interface ConstantItem {
    _id: string;
    type: string;
    value: string;
    templateId?: string;
    description?: string;
}

export default function GeneralSettings() {
    const [activeTab, setActiveTab] = useState('docIds');
    const [constants, setConstants] = useState<ConstantItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Types to manage
    const DOC_TYPES = ['Releases', 'Prelims', 'Certified Payroll Reports'];

    const fetchConstants = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/constants?types=${DOC_TYPES.join(',')}`);
            const data = await res.json();
            if (data.success) {
                // Ensure value is populated (fallback to description for legacy items like Releases)
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

    useEffect(() => {
        fetchConstants();
    }, []);

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
    
    // Delete functionality removed per user request

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header hideLogo={false} />
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Tabs */}
                    <div className="flex gap-6 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('docIds')}
                            className={`pb-3 px-2 font-bold text-sm transition-all ${
                                activeTab === 'docIds' 
                                ? 'text-[#0F4C75] border-b-2 border-[#0F4C75]' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Estimate Document Ids
                        </button>
                    </div>

                    {loading ? (
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
                    )}
                </div>
            </div>
        </div>
    );
}
