'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, DollarSign } from 'lucide-react';
import { DEFAULT_THRESHOLDS, THRESHOLD_LABELS, FinancialThresholds } from '@/lib/constants/financialThresholds';

export default function FinancialsSettingsPage() {
    const [values, setValues] = useState<FinancialThresholds>(DEFAULT_THRESHOLDS);
    const [saved, setSaved] = useState<FinancialThresholds>(DEFAULT_THRESHOLDS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    useEffect(() => {
        fetch('/api/settings/financial-thresholds')
            .then(r => r.json())
            .then(data => { setValues(data); setSaved(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const hasChanges = JSON.stringify(values) !== JSON.stringify(saved);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings/financial-thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const json = await res.json();
            if (json.success) {
                setSaved(json.data);
                setValues(json.data);
                setToast('Thresholds saved');
                setTimeout(() => setToast(''), 2500);
            }
        } catch { setToast('Failed to save'); setTimeout(() => setToast(''), 2500); }
        finally { setSaving(false); }
    }, [values]);

    const handleReset = () => setValues(DEFAULT_THRESHOLDS);

    const updateField = (key: keyof FinancialThresholds, val: string) => {
        setValues(prev => ({ ...prev, [key]: Number(val) || 0 }));
    };

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-xl" />
                ))}
            </div>
        );
    }

    const keys = Object.keys(THRESHOLD_LABELS) as (keyof FinancialThresholds)[];

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-md">
                        <DollarSign className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Financial Thresholds</h2>
                        <p className="text-xs text-slate-500 font-medium">Controls insights engine alerts and chart reference lines</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            hasChanges
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Fields */}
            <div className="space-y-3">
                {keys.map(key => {
                    const meta = THRESHOLD_LABELS[key];
                    const isChanged = values[key] !== saved[key];
                    return (
                        <div
                            key={key}
                            className={`rounded-xl border p-4 transition-all ${
                                isChanged ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 bg-white'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <label className="text-sm font-bold text-slate-800">{meta.label}</label>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{meta.description}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                        type="number"
                                        min={0}
                                        max={meta.suffix === '%' ? 100 : 999}
                                        step={1}
                                        value={values[key]}
                                        onChange={e => updateField(key, e.target.value)}
                                        className="w-20 text-right px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tabular-nums"
                                    />
                                    <span className="text-xs font-bold text-slate-400 w-8">{meta.suffix}</span>
                                </div>
                            </div>
                            {isChanged && (
                                <div className="mt-2 text-[10px] font-bold text-blue-600">
                                    Changed from {saved[key]}{meta.suffix}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-lg animate-in slide-in-from-bottom-4 z-50">
                    {toast}
                </div>
            )}
        </div>
    );
}
