'use client';

/**
 * WIPScheduleTable — Audit-grade WIP Schedule
 * ─────────────────────────────────────────────────────────────────────
 * Industry-standard construction WIP schedule used by auditors / CPAs.
 *
 * Columns:
 *   Project · Customer · Contract Value · Estimated Cost · Cost to Date ·
 *   % Complete · Earned Revenue · Billed to Date · Over/(Under) Billed · Margin %
 *
 * Features:
 *   - Client-side sort on every numeric column (click header)
 *   - Totals footer row with aggregated values
 *   - One-click Excel export via xlsx (already in package.json)
 *   - Compact print-optimized layout (no shadows, tighter fonts)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    ArrowUpDown, ArrowUp, ArrowDown,
    Download, FileSpreadsheet, TableProperties,
} from 'lucide-react';
import { fmtMoney } from '@/lib/format/money';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface WIPRow {
    id: string;
    project: string;
    customer: string;
    proposalNumber?: string;
    proposalSlug?: string;

    /** Signed contract value (original + change orders) */
    contractValue: number;
    /** Estimated total cost (budget) */
    estimatedCost: number;
    /** Actual cost incurred to date */
    costToDate: number;
    /** % complete (0-100) */
    pctComplete: number;
    /** Earned Revenue = contractValue × pctComplete / 100 */
    earnedRevenue: number;
    /** Amount billed to customer to date */
    billedToDate: number;
    /** Over-billing > 0; Under-billing < 0 */
    overUnderBilled: number;
    /** Gross margin on earned revenue */
    marginPct: number;
}

type SortKey = keyof Omit<WIPRow, 'id' | 'project' | 'customer' | 'proposalNumber' | 'proposalSlug'>;
type SortDir = 'asc' | 'desc';

interface WIPScheduleTableProps {
    rows: WIPRow[];
    periodLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function fmt(v: number) { return fmtMoney(v); }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }
function fmtOUB(v: number) {
    if (v === 0) return '—';
    return v > 0 ? `(+${fmtMoney(v)})` : `(${fmtMoney(v)})`;
}

/** OUB cell colour */
function oubColor(v: number) {
    if (v === 0) return 'text-slate-400';
    return v > 0 ? 'text-emerald-700 font-black' : 'text-red-600 font-black';
}

/** Margin badge */
function marginVariant(m: number): string {
    if (m >= 20) return 'text-green-700 bg-green-50';
    if (m >= 10) return 'text-amber-700 bg-amber-50';
    if (m >= 0)  return 'text-slate-600 bg-slate-50';
    return 'text-red-700 bg-red-50';
}

// ─────────────────────────────────────────────────────────────────────
// Excel export (uses xlsx already in package.json)
// ─────────────────────────────────────────────────────────────────────

async function exportToExcel(rows: WIPRow[], periodLabel = 'WIP Schedule') {
    const XLSX = await import('xlsx');

    const header = [
        'Project', 'Customer', 'Proposal #',
        'Contract Value', 'Est. Cost', 'Cost to Date',
        '% Complete', 'Earned Revenue', 'Billed to Date',
        'Over/(Under) Billed', 'Margin %',
    ];

    const data = rows.map(r => [
        r.project,
        r.customer,
        r.proposalNumber ?? '',
        r.contractValue,
        r.estimatedCost,
        r.costToDate,
        r.pctComplete / 100,        // Excel format as % below
        r.earnedRevenue,
        r.billedToDate,
        r.overUnderBilled,
        r.marginPct / 100,
    ]);

    // Totals row
    const totals = ['TOTAL', '', '',
        rows.reduce((s, r) => s + r.contractValue, 0),
        rows.reduce((s, r) => s + r.estimatedCost, 0),
        rows.reduce((s, r) => s + r.costToDate, 0),
        '',
        rows.reduce((s, r) => s + r.earnedRevenue, 0),
        rows.reduce((s, r) => s + r.billedToDate, 0),
        rows.reduce((s, r) => s + r.overUnderBilled, 0),
        '',
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, totals]);

    // Column widths
    ws['!cols'] = [
        { wch: 30 }, { wch: 22 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 10 }, { wch: 14 }, { wch: 14 },
        { wch: 18 }, { wch: 10 },
    ];

    // Format currency + percent columns
    const currencyCols = [3, 4, 5, 7, 8, 9]; // 0-indexed
    const pctCols = [6, 10];
    const numRows = data.length + 2; // header + data + totals

    for (let row = 1; row < numRows; row++) {
        currencyCols.forEach(col => {
            const addr = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[addr]) ws[addr].z = '$#,##0';
        });
        pctCols.forEach(col => {
            const addr = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[addr]) ws[addr].z = '0.0%';
        });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WIP Schedule');
    XLSX.writeFile(wb, `WIP_Schedule_${periodLabel.replace(/\s/g, '_')}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────
// Sort icon
// ─────────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
    if (col !== sortKey) return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400 ml-1 shrink-0" />;
    return sortDir === 'asc'
        ? <ArrowUp className="w-3 h-3 text-blue-500 ml-1 shrink-0" />
        : <ArrowDown className="w-3 h-3 text-blue-500 ml-1 shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────────
// Header cell
// ─────────────────────────────────────────────────────────────────────

function TH({
    label, col, sortKey, sortDir, onSort, right = false,
}: {
    label: string; col: SortKey; sortKey: SortKey | null; sortDir: SortDir;
    onSort: (col: SortKey) => void; right?: boolean;
}) {
    return (
        <th
            className={`group py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-slate-700 hover:bg-slate-50 transition-colors ${right ? 'text-right' : 'text-left'}`}
            onClick={() => onSort(col)}
        >
            <span className={`inline-flex items-center gap-0 ${right ? 'flex-row-reverse' : ''}`}>
                {label}
                <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
            </span>
        </th>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────

export function WIPScheduleTable({ rows, periodLabel = 'WIP Schedule' }: WIPScheduleTableProps) {
    const [sortKey, setSortKey] = useState<SortKey | null>('earnedRevenue');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [exporting, setExporting] = useState(false);

    const handleSort = useCallback((col: SortKey) => {
        setSortKey(prev => {
            if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else setSortDir('desc');
            return col;
        });
    }, []);

    const sorted = useMemo(() => {
        if (!sortKey) return rows;
        return [...rows].sort((a, b) => {
            const av = a[sortKey] as number;
            const bv = b[sortKey] as number;
            return sortDir === 'asc' ? av - bv : bv - av;
        });
    }, [rows, sortKey, sortDir]);

    // Totals
    const totals = useMemo(() => ({
        contractValue:   rows.reduce((s, r) => s + r.contractValue, 0),
        estimatedCost:   rows.reduce((s, r) => s + r.estimatedCost, 0),
        costToDate:      rows.reduce((s, r) => s + r.costToDate, 0),
        earnedRevenue:   rows.reduce((s, r) => s + r.earnedRevenue, 0),
        billedToDate:    rows.reduce((s, r) => s + r.billedToDate, 0),
        overUnderBilled: rows.reduce((s, r) => s + r.overUnderBilled, 0),
        marginPct: rows.length > 0
            ? rows.reduce((s, r) => s + r.marginPct, 0) / rows.length
            : 0,
    }), [rows]);

    const handleExport = async () => {
        setExporting(true);
        try { await exportToExcel(sorted, periodLabel); }
        finally { setExporting(false); }
    };

    if (rows.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400 text-sm">
                No projects match the current filters.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2">
                    <TableProperties className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500">
                        {rows.length} project{rows.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-300 text-[11px]">·</span>
                    <span className="text-[11px] font-bold text-slate-500">
                        {fmt(totals.contractValue)} total contract
                    </span>
                    <span className="text-slate-300 text-[11px]">·</span>
                    <span className={`text-[11px] font-black ${totals.overUnderBilled > 0 ? 'text-emerald-700' : totals.overUnderBilled < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {totals.overUnderBilled > 0 ? 'Over-billed' : totals.overUnderBilled < 0 ? 'Under-billed' : 'Balanced'}: {fmt(Math.abs(totals.overUnderBilled))}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-black hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                >
                    {exporting
                        ? <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                        : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    {exporting ? 'Exporting…' : 'Export Excel'}
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-sm">
                <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                            {/* Non-sortable text columns */}
                            <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                Project
                            </th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                Customer
                            </th>
                            {/* Sortable numeric columns */}
                            <TH label="Contract Value"      col="contractValue"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="Est. Cost"           col="estimatedCost"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="Cost to Date"        col="costToDate"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="% Complete"          col="pctComplete"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="Earned Revenue"      col="earnedRevenue"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="Billed to Date"      col="billedToDate"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="Over/(Under) Billed" col="overUnderBilled" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                            <TH label="Margin %"            col="marginPct"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {sorted.map(row => (
                            <tr
                                key={row.id}
                                className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                                onClick={() => {
                                    if (row.proposalSlug) window.open(`/estimates/${row.proposalSlug}`, '_blank');
                                }}
                                title={row.proposalSlug ? 'Click to open project' : undefined}
                            >
                                {/* Project */}
                                <td className="py-2.5 px-3 font-bold text-slate-800 max-w-[180px]">
                                    <div className="flex flex-col gap-0">
                                        <span className="truncate leading-tight">{row.project}</span>
                                        {row.proposalNumber && (
                                            <span className="text-[9px] font-bold text-blue-500 leading-tight">{row.proposalNumber}</span>
                                        )}
                                    </div>
                                </td>

                                {/* Customer */}
                                <td className="py-2.5 px-3 font-medium text-slate-600 max-w-[140px] truncate">
                                    {row.customer || '—'}
                                </td>

                                {/* Contract Value */}
                                <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                                    {fmt(row.contractValue)}
                                </td>

                                {/* Est. Cost */}
                                <td className="py-2.5 px-3 text-right font-medium tabular-nums text-slate-500">
                                    {fmt(row.estimatedCost)}
                                </td>

                                {/* Cost to Date */}
                                <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${row.costToDate > row.estimatedCost ? 'text-red-600' : 'text-slate-700'}`}>
                                    {fmt(row.costToDate)}
                                </td>

                                {/* % Complete */}
                                <td className="py-2.5 px-3 text-right">
                                    <div className="inline-flex flex-col items-end gap-0.5">
                                        <span className="font-black tabular-nums text-cyan-700">
                                            {fmtPct(row.pctComplete)}
                                        </span>
                                        {/* mini progress bar */}
                                        <div className="h-1 w-14 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-cyan-500 transition-all"
                                                style={{ width: `${Math.min(100, row.pctComplete)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>

                                {/* Earned Revenue */}
                                <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                                    {fmt(row.earnedRevenue)}
                                </td>

                                {/* Billed to Date */}
                                <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-700">
                                    {fmt(row.billedToDate)}
                                </td>

                                {/* Over/(Under) Billed */}
                                <td className={`py-2.5 px-3 text-right tabular-nums ${oubColor(row.overUnderBilled)}`}>
                                    {fmtOUB(row.overUnderBilled)}
                                </td>

                                {/* Margin % */}
                                <td className="py-2.5 px-3 text-right">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black tabular-nums ${marginVariant(row.marginPct)}`}>
                                        {fmtPct(row.marginPct)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    {/* Totals footer */}
                    <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                        <tr>
                            <td className="py-3 px-3 text-[10px] font-black uppercase tracking-wider text-slate-500" colSpan={2}>
                                Total ({rows.length} projects)
                            </td>
                            <td className="py-3 px-3 text-right font-black tabular-nums text-slate-900">
                                {fmt(totals.contractValue)}
                            </td>
                            <td className="py-3 px-3 text-right font-black tabular-nums text-slate-600">
                                {fmt(totals.estimatedCost)}
                            </td>
                            <td className="py-3 px-3 text-right font-black tabular-nums text-slate-700">
                                {fmt(totals.costToDate)}
                            </td>
                            <td className="py-3 px-3 text-right font-black tabular-nums text-cyan-700">
                                {/* weighted avg % complete */}
                                {totals.contractValue > 0
                                    ? fmtPct((totals.earnedRevenue / totals.contractValue) * 100)
                                    : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-black tabular-nums text-slate-900">
                                {fmt(totals.earnedRevenue)}
                            </td>
                            <td className="py-3 px-3 text-right font-black tabular-nums text-slate-700">
                                {fmt(totals.billedToDate)}
                            </td>
                            <td className={`py-3 px-3 text-right font-black tabular-nums ${oubColor(totals.overUnderBilled)}`}>
                                {fmtOUB(totals.overUnderBilled)}
                            </td>
                            <td className="py-3 px-3 text-right">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black tabular-nums ${marginVariant(totals.marginPct)}`}>
                                    {fmtPct(totals.marginPct)}
                                </span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Auditor's note */}
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed print:block">
                <strong className="text-slate-500">WIP Note:</strong> Earned Revenue = Contract Value × % Complete.
                Over-billed (+) = billed exceeds earned (liability); Under-billed (−) = earned exceeds billed (asset).
                % Complete based on cost-to-cost method. Figures unaudited and subject to final review.
            </p>
        </div>
    );
}

export default WIPScheduleTable;
