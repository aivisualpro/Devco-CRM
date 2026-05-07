'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BookmarkPlus, Check, X, AlertCircle } from 'lucide-react';
import { nameToSlug } from './useSavedViews';

interface SaveViewModalProps {
    open: boolean;
    saving?: boolean;
    /** Pre-fill name if editing */
    initialName?: string;
    onSave: (name: string, slug: string) => Promise<void> | void;
    onClose: () => void;
}

export function SaveViewModal({ open, saving, initialName = '', onSave, onClose }: SaveViewModalProps) {
    const [name, setName] = useState(initialName);
    const [slug, setSlug] = useState(nameToSlug(initialName));
    const [slugEdited, setSlugEdited] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset when modal opens
    useEffect(() => {
        if (open) {
            setName(initialName);
            setSlug(nameToSlug(initialName));
            setSlugEdited(false);
            setError('');
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [open, initialName]);

    const handleNameChange = (v: string) => {
        setName(v);
        if (!slugEdited) setSlug(nameToSlug(v));
    };

    const handleSlugChange = (v: string) => {
        const clean = v.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        setSlug(clean);
        setSlugEdited(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setError('Name is required'); return; }
        if (!slug.trim()) { setError('Slug is required'); return; }
        setError('');
        await onSave(name.trim(), slug.trim());
    };

    if (!open) return null;

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <BookmarkPlus className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-black text-slate-900">Save View</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                            View name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="e.g. This Year — High Margin"
                            maxLength={60}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                            URL slug <span className="font-medium text-slate-400 lowercase tracking-normal">(auto-generated)</span>
                        </label>
                        <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition">
                            <span className="px-2.5 py-2 text-[11px] font-bold text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap select-none">
                                view/
                            </span>
                            <input
                                type="text"
                                value={slug}
                                onChange={e => handleSlugChange(e.target.value)}
                                maxLength={40}
                                className="flex-1 px-2.5 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-black text-white transition flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Check className="w-3.5 h-3.5" />
                            )}
                            {saving ? 'Saving…' : 'Save view'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
