'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Bookmark, ChevronRight, Trash2, Pencil, Link2, Check, MoreHorizontal,
} from 'lucide-react';
import { SavedView } from './useSavedViews';

interface SavedViewChipsProps {
    views: SavedView[];
    activeSlug?: string | null;
    onLoad: (view: SavedView) => void;
    onDelete: (slug: string) => void;
    onRename: (slug: string, name: string) => void;
    onShare: (view: SavedView) => void;
}

// ─────────────────────────────────────────────
// Right-click / long-press context menu
// ─────────────────────────────────────────────

interface ContextMenuState {
    view: SavedView;
    x: number;
    y: number;
}

function ContextMenu({
    ctx,
    onEdit,
    onDelete,
    onShare,
    onClose,
}: {
    ctx: ContextMenuState;
    onEdit: () => void;
    onDelete: () => void;
    onShare: () => void;
    onClose: () => void;
}) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
            onClose();
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [onClose]);

    // Clamp to viewport
    const left = typeof window !== 'undefined'
        ? Math.min(ctx.x, window.innerWidth - 180)
        : ctx.x;
    const top = typeof window !== 'undefined'
        ? Math.min(ctx.y, window.innerHeight - 140)
        : ctx.y;

    return (
        <div
            ref={menuRef}
            className="fixed z-[200] w-44 rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden py-1"
            style={{ left, top }}
            onClick={e => e.stopPropagation()}
        >
            <button
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                onClick={() => { onEdit(); onClose(); }}
            >
                <Pencil className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                Rename
            </button>
            <button
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                onClick={() => { onShare(); onClose(); }}
            >
                <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Copy share link
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                onClick={() => { onDelete(); onClose(); }}
            >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                Delete
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────
// Inline rename input
// ─────────────────────────────────────────────

function RenameInput({
    initialName,
    onSave,
    onCancel,
}: { initialName: string; onSave: (name: string) => void; onCancel: () => void }) {
    const [val, setVal] = useState(initialName);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);

    return (
        <form
            onSubmit={e => { e.preventDefault(); if (val.trim()) onSave(val.trim()); }}
            className="flex items-center gap-1"
            onClick={e => e.stopPropagation()}
        >
            <input
                ref={ref}
                value={val}
                onChange={e => setVal(e.target.value)}
                className="text-xs font-bold rounded-lg border border-blue-400 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36"
                onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
                maxLength={60}
                autoFocus
            />
            <button type="submit" className="text-blue-600 hover:text-blue-800">
                <Check className="w-3 h-3" />
            </button>
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                ×
            </button>
        </form>
    );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function SavedViewChips({
    views,
    activeSlug,
    onLoad,
    onDelete,
    onRename,
    onShare,
}: SavedViewChipsProps) {
    const [ctx, setCtx] = useState<ContextMenuState | null>(null);
    const [renaming, setRenaming] = useState<string | null>(null); // slug being renamed
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, view: SavedView) => {
        e.preventDefault();
        setCtx({ view, x: e.clientX, y: e.clientY });
    }, []);

    const handleShare = useCallback((view: SavedView) => {
        onShare(view);
        setCopiedSlug(view.slug);
        setTimeout(() => setCopiedSlug(null), 2000);
    }, [onShare]);

    if (views.length === 0) return null;

    return (
        <>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 shrink-0 flex items-center gap-1">
                    <Bookmark className="w-2.5 h-2.5" />
                    Saved
                </span>

                {views.map(view => {
                    const isActive = activeSlug === view.slug;
                    const isCopied = copiedSlug === view.slug;

                    return (
                        <div
                            key={view.slug}
                            className={`
                                group relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
                                text-[11px] font-bold transition-all duration-150 select-none
                                ${isActive
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 cursor-pointer'
                                }
                            `}
                            onClick={() => renaming !== view.slug && onLoad(view)}
                            onContextMenu={e => handleContextMenu(e, view)}
                            title="Click to load · Right-click for options"
                        >
                            {renaming === view.slug ? (
                                <RenameInput
                                    initialName={view.name}
                                    onSave={(name) => { onRename(view.slug, name); setRenaming(null); }}
                                    onCancel={() => setRenaming(null)}
                                />
                            ) : (
                                <>
                                    <span className="truncate max-w-[120px]">{view.name}</span>

                                    {/* ⋯ button — shows on hover */}
                                    <button
                                        type="button"
                                        className={`
                                            opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5
                                            ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-100 text-slate-400'}
                                        `}
                                        onClick={e => { e.stopPropagation(); handleContextMenu(e as any, view); }}
                                        title="Options"
                                    >
                                        <MoreHorizontal className="w-3 h-3" />
                                    </button>

                                    {isCopied && (
                                        <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-600">
                                            <Check className="w-2.5 h-2.5" /> Copied
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Context menu */}
            {ctx && (
                <ContextMenu
                    ctx={ctx}
                    onEdit={() => setRenaming(ctx.view.slug)}
                    onDelete={() => onDelete(ctx.view.slug)}
                    onShare={() => handleShare(ctx.view)}
                    onClose={() => setCtx(null)}
                />
            )}
        </>
    );
}
