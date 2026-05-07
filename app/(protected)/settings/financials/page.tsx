'use client';

import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Info, CheckCircle2, AlertCircle, Loader2, TrendingUp, Users, Clock, FileCheck, FileX } from 'lucide-react';
import { DEFAULT_THRESHOLDS, THRESHOLD_LABELS, FinancialThresholds } from '@/lib/constants/financialThresholds';

// ── Types ──────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

// ── Field icons ────────────────────────────────────────────────────────

const FIELD_ICONS: Record<keyof FinancialThresholds, React.ReactNode> = {
    targetGrossMarginPct:      <TrendingUp className="w-4 h-4" />,
    customerConcentrationPct:  <Users className="w-4 h-4" />,
    dsoWarningDays:            <Clock className="w-4 h-4" />,
    underBillingTolerancePct:  <FileCheck className="w-4 h-4" />,
    overBillingTolerancePct:   <FileX className="w-4 h-4" />,
};

const FIELD_ORDER: (keyof FinancialThresholds)[] = [
    'targetGrossMarginPct',
    'customerConcentrationPct',
    'dsoWarningDays',
    'underBillingTolerancePct',
    'overBillingTolerancePct',
];

// ── Slider min/max/step per field ──────────────────────────────────────

const FIELD_RANGES: Record<keyof FinancialThresholds, { min: number; max: number; step: number }> = {
    targetGrossMarginPct:     { min: 0,   max: 60,  step: 1  },
    customerConcentrationPct: { min: 10,  max: 80,  step: 5  },
    dsoWarningDays:           { min: 15,  max: 180, step: 5  },
    underBillingTolerancePct: { min: 0,   max: 30,  step: 1  },
    overBillingTolerancePct:  { min: 0,   max: 30,  step: 1  },
};

// ── Components ─────────────────────────────────────────────────────────

function ThresholdField({
    field,
    value,
    onChange,
}: {
    field: keyof FinancialThresholds;
    value: number;
    onChange: (v: number) => void;
}) {
    const meta    = THRESHOLD_LABELS[field];
    const range   = FIELD_RANGES[field];
    const icon    = FIELD_ICONS[field];
    const pct     = ((value - range.min) / (range.max - range.min)) * 100;
    const defaultV = DEFAULT_THRESHOLDS[field];
    const isChanged = value !== defaultV;

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        {icon}
                    </div>
                    <div>
                        <div className="text-[12px] font-black text-slate-800">{meta.label}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{meta.description}</div>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-xl font-black text-slate-900 tabular-nums leading-none">
                        {value}{meta.suffix}
                    </div>
                    {isChanged && (
                        <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                            default: {defaultV}{meta.suffix}
                        </div>
                    )}
                </div>
            </div>

            {/* Slider */}
            <div className="space-y-1.5">
                <div className="relative h-2 rounded-full bg-slate-100">
                    {/* Filled track */}
                    <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-150"
                        style={{ width: `${pct}%` }}
                    />
                    <input
                        type="range"
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        value={value}
                        onChange={e => onChange(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label={meta.label}
                    />
                    {/* Thumb */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-sm transition-all duration-150 pointer-events-none"
                        style={{ left: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-300 font-medium">
                    <span>{range.min}{meta.suffix}</span>
                    <span>{range.max}{meta.suffix}</span>
                </div>
            </div>

            {/* Number input */}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={value}
                    onChange={e => {
                        const v = Math.min(range.max, Math.max(range.min, Number(e.target.value)));
                        onChange(v);
                    }}
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-black text-slate-900 tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                />
                <span className="text-sm text-slate-400 font-medium">{meta.suffix}</span>
                {isChanged && (
                    <button
                        type="button"
                        onClick={() => onChange(defaultV)}
                        className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                        title="Reset to default"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function FinancialSettingsPage() {
    const [values, setValues] = useState<FinancialThresholds>(DEFAULT_THRESHOLDS);
    const [status, setStatus] = useState<Status>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [dirty, setDirty] = useState(false);

    // Load current thresholds
    useEffect(() => {
        fetch('/api/settings/financial-thresholds')
            .then(r => r.json())
            .then(data => {
                setValues({ ...DEFAULT_THRESHOLDS, ...data });
                setStatus('idle');
            })
            .catch(() => setStatus('idle'));
    }, []);

    const handleChange = (field: keyof FinancialThresholds, value: number) => {
        setValues(prev => ({ ...prev, [field]: value }));
        setDirty(true);
        if (status === 'saved' || status === 'error') setStatus('idle');
    };

    const handleReset = () => {
        setValues(DEFAULT_THRESHOLDS);
        setDirty(true);
    };

    const handleSave = async () => {
        setStatus('saving');
        setErrorMsg('');
        try {
            const r = await fetch('/api/settings/financial-thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            if (!r.ok) throw new Error(await r.text());
            setStatus('saved');
            setDirty(false);
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e: any) {
            setStatus('error');
            setErrorMsg(e.message || 'Save failed');
        }
    };

    return (
        <div className="min-h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200/80 px-6 py-5">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Financial Settings</h1>
                        <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                            Configure thresholds that drive the Insights Engine, chart reference lines, and dashboard alerts.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {dirty && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-black hover:bg-slate-50 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset all
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={status === 'saving' || !dirty}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-black hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            {status === 'saving'
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Save className="w-3.5 h-3.5" />}
                            {status === 'saving' ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status banner */}
            {status === 'saved' && (
                <div className="max-w-3xl mx-auto mt-4 px-6">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-[12px] font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Thresholds saved. Insights and charts will reflect these values on next refresh.
                    </div>
                </div>
            )}
            {status === 'error' && (
                <div className="max-w-3xl mx-auto mt-4 px-6">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errorMsg || 'Failed to save. Try again.'}
                    </div>
                </div>
            )}

            {/* Fields */}
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
                {/* How it works callout */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-800 font-medium">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                    <span>
                        These thresholds are stored globally and applied to all users. The Insights Engine uses them
                        to determine severity of alerts. The Margin Trend chart draws a reference line at your target margin.
                        Changes take effect on the next data refresh (60-second cache).
                    </span>
                </div>

                {status === 'loading' ? (
                    <div className="space-y-4">
                        {FIELD_ORDER.map(f => (
                            <div key={f} className="h-36 rounded-2xl border border-slate-200/60 bg-slate-100/60 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    FIELD_ORDER.map(field => (
                        <ThresholdField
                            key={field}
                            field={field}
                            value={values[field]}
                            onChange={v => handleChange(field, v)}
                        />
                    ))
                )}

                {/* Unsaved indicator */}
                {dirty && status !== 'saving' && (
                    <p className="text-center text-[10px] text-slate-400 font-bold">
                        You have unsaved changes
                    </p>
                )}
            </div>
        </div>
    );
}
