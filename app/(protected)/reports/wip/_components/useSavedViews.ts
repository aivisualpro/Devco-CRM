'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { DrillKey } from '@/lib/financials/drillDown';
import { DatePreset } from './FinancialsSidebar';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SavedView {
    id: string;
    slug: string;
    name: string;
    owner?: string;
    datePreset?: DatePreset;
    dateFrom?: string;
    dateTo?: string;
    proposalWriters?: string[];
    statuses?: string[];
    customers?: string[];
    drill?: DrillKey;
    drillValue?: string;
    updatedAt?: string;
}

export interface ViewFilterState {
    datePreset: DatePreset;
    dateFrom: string;
    dateTo: string;
    proposalWriters: string[];
    statuses: string[];
    customers: string[];
    drill?: DrillKey;
    drillValue?: string;
}

const SWR_KEY = '/api/financials/saved-views';

const fetcher = (url: string) =>
    fetch(url).then(r => r.json()).then(d => d.views ?? []);

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useSavedViews() {
    const { data: views = [], isLoading, error } = useSWR<SavedView[]>(SWR_KEY, fetcher, {
        revalidateOnFocus: false,
    });

    const [saving, setSaving] = useState(false);

    /** Save (create or overwrite) a view with the current filter state */
    const saveView = useCallback(async (slug: string, name: string, state: ViewFilterState) => {
        setSaving(true);
        try {
            const res = await fetch(SWR_KEY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, name, ...state }),
            });
            if (!res.ok) throw new Error(await res.text());
            await globalMutate(SWR_KEY);
        } finally {
            setSaving(false);
        }
    }, []);

    /** Delete a view by slug */
    const deleteView = useCallback(async (slug: string) => {
        await fetch(SWR_KEY, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
        });
        await globalMutate(SWR_KEY);
    }, []);

    /** Rename a view */
    const renameView = useCallback(async (slug: string, name: string) => {
        await fetch(SWR_KEY, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, name }),
        });
        await globalMutate(SWR_KEY);
    }, []);

    return { views, isLoading, error, saving, saveView, deleteView, renameView };
}

// ─────────────────────────────────────────────
// URL serializer — build a shareable URL from a ViewFilterState
// ─────────────────────────────────────────────

export function buildShareUrl(state: ViewFilterState & { name?: string }, base?: string): string {
    const url = new URL(
        base ?? (typeof window !== 'undefined' ? window.location.href : '/'),
        'http://x',
    );
    url.searchParams.set('view', 'financials');
    if (state.datePreset && state.datePreset !== 'all_time') url.searchParams.set('preset', state.datePreset);
    if (state.dateFrom) url.searchParams.set('from', state.dateFrom);
    if (state.dateTo)   url.searchParams.set('to',   state.dateTo);
    if (state.proposalWriters?.length) url.searchParams.set('pms', state.proposalWriters.join(','));
    if (state.statuses?.length)        url.searchParams.set('statuses', state.statuses.join(','));
    if (state.customers?.length)       url.searchParams.set('customers', state.customers.join(','));
    if (state.drill)      url.searchParams.set('drill', state.drill);
    if (state.drillValue) url.searchParams.set('drillValue', state.drillValue);
    return url.pathname + url.search;
}

/** Parse URL search params back into a ViewFilterState */
export function parseShareUrl(params: URLSearchParams): Partial<ViewFilterState> {
    return {
        datePreset:      (params.get('preset') as DatePreset) || 'all_time',
        dateFrom:         params.get('from') || '',
        dateTo:           params.get('to')   || '',
        proposalWriters:  params.get('pms')?.split(',').filter(Boolean) || [],
        statuses:         params.get('statuses')?.split(',').filter(Boolean) || [],
        customers:        params.get('customers')?.split(',').filter(Boolean) || [],
        drill:            (params.get('drill') as DrillKey) || undefined,
        drillValue:       params.get('drillValue') || undefined,
    };
}

/** Generate a slug from a name */
export function nameToSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40);
}
