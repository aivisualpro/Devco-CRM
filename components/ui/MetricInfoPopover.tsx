'use client';

/**
 * MetricInfoPopover — polished metric explainer (Parts 3 & 4)
 *
 * Trigger     : single-click OR hover ≥ 600 ms OR Enter/Space when focused.
 * Desktop     : Radix Popover, 380 px, arrow, close on Escape / outside / X.
 * Mobile      : vaul bottom Drawer (< 640 px breakpoint).
 * Catalog     : lazy-loaded on first open.
 * A11y        : aria-label, role="dialog", aria-labelledby, focus-trap (Radix).
 * Settings    : Fetches financialThresholds on first open; shows a
 *               "Customized in Settings →" badge when any threshold that
 *               drives this metric has been overridden from the default.
 */

import React, {
    useState,
    useCallback,
    useRef,
    useEffect,
    useId,
    lazy,
    Suspense,
} from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Drawer } from 'vaul';
import {
    Info,
    X,
    Copy,
    Check,
    ChevronRight,
    ChevronDown,
    ExternalLink,
} from 'lucide-react';
import type { MetricExplainer } from '@/lib/financials/metricCatalog';
import type { FinancialThresholds } from '@/lib/constants/financialThresholds';

// ── Lazy catalog ──────────────────────────────────────────────────────────────

let catalogCache: Map<string, MetricExplainer> | null = null;

// ── Lazy thresholds ──────────────────────────────────────────────────────────

let thresholdsCache: FinancialThresholds | null = null;

async function loadThresholds(): Promise<FinancialThresholds> {
    if (thresholdsCache) return thresholdsCache;
    try {
        const res = await fetch('/api/settings/financial-thresholds', { cache: 'no-store' });
        if (res.ok) {
            const json = await res.json();
            thresholdsCache = json as FinancialThresholds;
            return thresholdsCache;
        }
    } catch {}
    // Fall back to defaults
    const { DEFAULT_THRESHOLDS } = await import('@/lib/constants/financialThresholds');
    thresholdsCache = DEFAULT_THRESHOLDS;
    return thresholdsCache;
}

/**
 * Maps metric IDs to the threshold keys that govern their "Healthy Values".
 * Used to show the "Customized in Settings" badge.
 */
const METRIC_THRESHOLD_KEYS: Record<string, Array<keyof FinancialThresholds>> = {
    grossMargin:               ['targetGrossMarginPct'],
    'margin-trend':            ['targetGrossMarginPct'],
    grossProfit:               ['targetGrossMarginPct'],
    dso:                       ['dsoWarningDays'],
    arOutstanding:             ['dsoWarningDays'],
    'ar-aging':                ['dsoWarningDays'],
    'insight-slow-paying-customers': ['dsoWarningDays'],
    overUnderBilling:          ['underBillingTolerancePct', 'overBillingTolerancePct'],
    'customer-concentration':  ['customerConcentrationPct'],
    'health-heatmap':          ['targetGrossMarginPct', 'dsoWarningDays', 'customerConcentrationPct'],
};

async function loadExplainer(id: string): Promise<MetricExplainer | null> {
    if (!catalogCache) {
        const mod = await import('@/lib/financials/metricCatalog');
        const list: MetricExplainer[] = mod.default;
        catalogCache = new Map(list.map((m) => [m.id, m]));
    }
    return catalogCache.get(id) ?? null;
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = useCallback(() => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [text]);
    return (
        <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-700 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-100"
            title="Copy formula"
            aria-label="Copy formula to clipboard"
        >
            {copied ? (
                <Check className="w-3 h-3 text-green-500" />
            ) : (
                <Copy className="w-3 h-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

function Section({
    title,
    count,
    defaultOpen = true,
    children,
}: {
    title: string;
    count?: number;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-1.5 text-left mb-2 group"
            >
                {open ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                )}
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                    {title}
                    {count !== undefined && (
                        <span className="ml-1 text-slate-300">({count})</span>
                    )}
                </span>
            </button>
            {open && children}
        </div>
    );
}

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-slate-100 last:border-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-start justify-between gap-2 py-2 text-left"
            >
                <span className="text-[11px] font-bold text-slate-700 leading-snug">
                    {q}
                </span>
                {open ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                )}
            </button>
            {open && (
                <p className="text-[11px] text-slate-500 leading-relaxed pb-2 font-medium">
                    {a}
                </p>
            )}
        </div>
    );
}

// ── Content ───────────────────────────────────────────────────────────────────

function ExplainerBody({
    explainer,
    titleId,
    onRelatedClick,
    thresholds,
    defaults,
}: {
    explainer: MetricExplainer;
    titleId: string;
    onRelatedClick: (id: string) => void;
    thresholds: FinancialThresholds | null;
    defaults: FinancialThresholds | null;
}) {
    /** True if any threshold driving this metric has been customized */
    const isCustomized = React.useMemo(() => {
        if (!thresholds || !defaults) return false;
        const keys = METRIC_THRESHOLD_KEYS[explainer.id] ?? [];
        return keys.some((k) => thresholds[k] !== defaults[k]);
    }, [thresholds, defaults, explainer.id]);

    /** Humanise camelCase / kebab-case IDs into readable chip labels */
    function humanise(id: string) {
        return id
            .replace(/-/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return (
        <div className="space-y-4 text-slate-800">
            {/* Short definition */}
            <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                {explainer.shortDef}
            </p>

            {/* Formula */}
            <Section title="Formula">
                <div className="rounded-lg bg-slate-900 px-3 py-2.5 flex items-start justify-between gap-2">
                    <code className="text-green-400 text-[11px] font-mono leading-relaxed break-all flex-1">
                        {explainer.formula}
                    </code>
                    <CopyButton text={explainer.formula} />
                </div>
            </Section>

            {/* Inputs */}
            <Section title="Inputs" count={explainer.inputs.length}>
                <div className="rounded-lg border border-slate-100 overflow-hidden divide-y divide-slate-50 text-[10px]">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_1.4fr_1fr] px-2.5 py-1.5 bg-slate-100 font-black uppercase tracking-widest text-slate-400 text-[8px]">
                        <span>Label</span>
                        <span>Source</span>
                        <span>Notes</span>
                    </div>
                    {explainer.inputs.map((inp, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-[1fr_1.4fr_1fr] px-2.5 py-2 bg-slate-50/60 gap-1"
                        >
                            <span className="font-bold text-slate-700 leading-snug">
                                {inp.label}
                            </span>
                            <span className="text-slate-400 font-medium leading-snug break-all">
                                {inp.source}
                            </span>
                            <span className="text-amber-600 font-medium leading-snug italic">
                                {inp.notes ?? '—'}
                            </span>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Why it matters */}
            <Section title="Why It Matters">
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    {explainer.why}
                </p>
            </Section>

            {/* Healthy values */}
            <Section title="Healthy Values">
                <div className="rounded-lg overflow-hidden divide-y divide-white text-[11px] font-medium">
                    <div className="flex gap-2 px-3 py-2 bg-green-50">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-1" />
                        <span className="text-green-800 leading-snug">
                            <span className="font-black">Good: </span>
                            {explainer.interpretation.good}
                        </span>
                    </div>
                    <div className="flex gap-2 px-3 py-2 bg-amber-50">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                        <span className="text-amber-800 leading-snug">
                            <span className="font-black">Watch: </span>
                            {explainer.interpretation.watch}
                        </span>
                    </div>
                    <div className="flex gap-2 px-3 py-2 bg-red-50">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1" />
                        <span className="text-red-800 leading-snug">
                            <span className="font-black">Bad: </span>
                            {explainer.interpretation.bad}
                        </span>
                    </div>
                </div>
                {/* Settings customization badge */}
                {isCustomized && (
                    <a
                        href="/settings/financials"
                        className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:underline"
                    >
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Customized in Settings
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                )}
            </Section>

            {/* Related metrics */}
            {explainer.relatedMetrics.length > 0 && (
                <Section title="Related Metrics" defaultOpen={true}>
                    <div className="flex flex-wrap gap-1.5">
                        {explainer.relatedMetrics.map((id) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onRelatedClick(id)}
                                className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold hover:bg-blue-100 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                {humanise(id)}
                            </button>
                        ))}
                    </div>
                </Section>
            )}

            {/* FAQ */}
            {explainer.faq && explainer.faq.length > 0 && (
                <Section title="FAQ" count={explainer.faq.length} defaultOpen={false}>
                    <div>
                        {explainer.faq.map((item, i) => (
                            <FaqItem key={i} {...item} />
                        ))}
                    </div>
                </Section>
            )}

            {/* See Also */}
            {explainer.seeAlso && explainer.seeAlso.length > 0 && (
                <Section title="See Also" defaultOpen={false}>
                    <div className="flex flex-col gap-1">
                        {explainer.seeAlso.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline"
                            >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {link.label}
                            </a>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}

// ── Shared header (desktop + mobile) ──────────────────────────────────────────

function PopoverHeader({
    title,
    titleId,
    canGoBack,
    onBack,
    onClose,
}: {
    title: string;
    titleId: string;
    canGoBack: boolean;
    onBack: () => void;
    onClose: () => void;
}) {
    return (
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-100 z-10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    {canGoBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="text-[9px] font-bold text-blue-500 hover:text-blue-700 mb-1 block"
                        >
                            ← Back
                        </button>
                    )}
                    <h2
                        id={titleId}
                        className="text-[13px] font-black text-slate-900 leading-tight"
                    >
                        {title}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-300 hover:text-slate-700 transition-colors shrink-0 mt-0.5 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface MetricInfoPopoverProps {
    metricId: string;
    align?: 'start' | 'center' | 'end';
    iconSize?: number;
    side?: 'top' | 'right' | 'bottom' | 'left';
}

export function MetricInfoPopover({
    metricId,
    align = 'end',
    iconSize = 14,
    side = 'bottom',
}: MetricInfoPopoverProps) {
    const titleId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [open, setOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [activeId, setActiveId] = useState(metricId);
    const [explainer, setExplainer] = useState<MetricExplainer | null>(null);
    const [loading, setLoading] = useState(false);
    const [thresholds, setThresholds] = useState<FinancialThresholds | null>(null);
    const [defaults, setDefaults] = useState<FinancialThresholds | null>(null);

    // Detect mobile
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Load catalog entry whenever activeId or open changes
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        loadExplainer(activeId).then((e) => {
            setExplainer(e);
            setLoading(false);
        });
    }, [activeId, open]);

    // Load thresholds once on first open
    useEffect(() => {
        if (!open || thresholds) return;
        Promise.all([
            loadThresholds(),
            import('@/lib/constants/financialThresholds').then((m) => m.DEFAULT_THRESHOLDS),
        ]).then(([live, defs]) => {
            setThresholds(live);
            setDefaults(defs);
        });
    }, [open, thresholds]);

    const openPopover = useCallback(() => setOpen(true), []);

    const closePopover = useCallback(() => {
        setOpen(false);
        // return focus to trigger
        setTimeout(() => triggerRef.current?.focus(), 50);
        setTimeout(() => setActiveId(metricId), 200);
    }, [metricId]);

    const handleOpenChange = useCallback(
        (o: boolean) => {
            if (!o) closePopover();
            else setOpen(true);
        },
        [closePopover],
    );

    const handleRelatedClick = useCallback((id: string) => setActiveId(id), []);
    const handleBack = useCallback(() => setActiveId(metricId), [metricId]);

    // Hover logic
    const onMouseEnter = useCallback(() => {
        hoverTimer.current = setTimeout(openPopover, 600);
    }, [openPopover]);

    const onMouseLeave = useCallback(() => {
        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    }, []);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPopover();
            }
        },
        [openPopover],
    );

    const triggerLabel = explainer
        ? `Learn about ${explainer.title}`
        : `Learn about ${metricId}`;

    // ── Body content (shared by desktop + mobile) ─────────────────────────
    const bodyContent = (
        <>
            <PopoverHeader
                title={explainer?.title ?? activeId}
                titleId={titleId}
                canGoBack={activeId !== metricId}
                onBack={handleBack}
                onClose={closePopover}
            />
            <div className="px-4 py-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <span className="text-[12px] text-slate-400 animate-pulse">
                            Loading…
                        </span>
                    </div>
                ) : explainer ? (
                    <ExplainerBody
                        explainer={explainer}
                        titleId={titleId}
                        onRelatedClick={handleRelatedClick}
                        thresholds={thresholds}
                        defaults={defaults}
                    />
                ) : (
                    <p className="text-[12px] text-slate-400">
                        No explainer found for <code>{activeId}</code>.
                    </p>
                )}
            </div>
        </>
    );

    // ── Trigger button (shared) ───────────────────────────────────────────
    // Wrapped in overflow-visible so parent overflow-hidden cards don't clip it.
    const triggerButton = (
        <span className="relative overflow-visible inline-flex items-center">
            <button
                ref={triggerRef}
                type="button"
                aria-label={triggerLabel}
                className="text-slate-300 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 rounded"
                onClick={(e) => {
                    e.stopPropagation();
                    openPopover();
                }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onKeyDown={onKeyDown}
            >
                <Info style={{ width: iconSize, height: iconSize }} />
            </button>
        </span>
    );

    // ── Mobile: vaul Drawer ───────────────────────────────────────────────
    if (isMobile) {
        return (
            <>
                {triggerButton}
                <Drawer.Root open={open} onOpenChange={handleOpenChange}>
                    <Drawer.Portal>
                        <Drawer.Overlay className="fixed inset-0 z-[199] bg-black/40" />
                        <Drawer.Content
                            role="dialog"
                            aria-labelledby={titleId}
                            className="fixed bottom-0 left-0 right-0 z-[200] flex flex-col rounded-t-2xl bg-white max-h-[90dvh] outline-none"
                        >
                            {/* Drag handle */}
                            <div className="mx-auto mt-3 mb-1 w-10 h-1.5 rounded-full bg-slate-200" />
                            <div className="overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {bodyContent}
                                {/* safe area */}
                                <div className="h-6" />
                            </div>
                        </Drawer.Content>
                    </Drawer.Portal>
                </Drawer.Root>
            </>
        );
    }

    // ── Desktop: Radix Popover ────────────────────────────────────────────
    // Use Popover.Anchor (not Trigger) so Radix never intercepts our button
    // events — hover and click are handled 100% by our own handlers.
    return (
        <Popover.Root open={open} onOpenChange={handleOpenChange}>
            <Popover.Anchor asChild>{triggerButton}</Popover.Anchor>

            <Popover.Portal>
                <Popover.Content
                    role="dialog"
                    aria-labelledby={titleId}
                    align={align}
                    side={side}
                    sideOffset={10}
                    collisionPadding={12}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onEscapeKeyDown={closePopover}
                    onPointerDownOutside={closePopover}
                    className={[
                        'z-[9999] rounded-xl border border-slate-200 bg-white',
                        'shadow-xl shadow-slate-200/70',
                        'w-[380px] max-h-[80vh] overflow-y-auto outline-none',
                        'animate-in fade-in-0 zoom-in-95 duration-150',
                        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100',
                    ].join(' ')}
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {bodyContent}
                    <Popover.Arrow
                        width={14}
                        height={7}
                        className="fill-white drop-shadow-sm"
                        style={{ filter: 'drop-shadow(0 -1px 0 #e2e8f0)' }}
                    />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

export default MetricInfoPopover;
