'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Eye, Calendar, User, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import { Header, AddButton, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, BadgeTabs, Pagination, EmptyState, Loading, Modal, ConfirmModal, Badge, SkeletonTable } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';

interface Estimate {
    _id: string;
    estimate?: string;
    date?: string;
    customerId?: string;
    customerName?: string;
    proposalNo?: string;
    status?: string;
    bidMarkUp?: string | number;
    grandTotal?: number;
    subTotal?: number;
    margin?: number;
    versionNumber?: number;
    directionalDrilling?: boolean;
    excavationBackfill?: boolean;
    hydroExcavation?: boolean;
    potholingCoring?: boolean;
    asphaltConcrete?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export default function EstimatesPage() {
    const router = useRouter();
    const { toasts, success, error: toastError, removeToast } = useToast();

    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [showFinals, setShowFinals] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
    const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const itemsPerPage = 15;

    const fetchEstimates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEstimates' })
            });
            const data = await res.json();
            if (data.success) {
                setEstimates(data.result || []);
            } else {
                toastError('Failed to fetch estimates');
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to fetch estimates');
        } finally {
            setLoading(false);
        }
    };

    const isThisMonth = (d: string) => {
        if (!d) return false;
        const parts = d.split('/');
        if (parts.length !== 3) return false;
        const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    const isLastMonth = (d: string) => {
        if (!d) return false;
        const parts = d.split('/');
        if (parts.length !== 3) return false;
        const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
    };

    useEffect(() => {
        fetchEstimates();
    }, []);

    useEffect(() => {
        const drafts = new Set(estimates.filter(e => e.status === 'draft').map(e => e._id));
        setDraftIds(drafts);
    }, [estimates]);

    // Base filter: Finals (Latest Version) vs All
    const visibleEstimates = useMemo(() => {
        if (!showFinals) return estimates;

        const latestVersions = new Map<string, Estimate>();
        estimates.forEach(e => {
            const key = e.estimate || e._id;
            if (!latestVersions.has(key)) {
                latestVersions.set(key, e);
            } else {
                const current = latestVersions.get(key)!;
                if ((e.versionNumber || 0) > (current.versionNumber || 0)) {
                    latestVersions.set(key, e);
                }
            }
        });
        const latestIds = new Set(Array.from(latestVersions.values()).map(e => e._id));
        return estimates.filter(e => latestIds.has(e._id));
    }, [estimates, showFinals]);

    // Filter and search on top of visibleEstimates
    const filteredEstimates = useMemo(() => {
        let filtered = [...visibleEstimates];

        // Apply date filter
        if (activeFilter === 'thisMonth') {
            filtered = filtered.filter((e) => isThisMonth(e.date || ''));
        } else if (activeFilter === 'lastMonth') {
            filtered = filtered.filter((e) => isLastMonth(e.date || ''));
        } else if (activeFilter === 'draft') {
            filtered = filtered.filter((e) => e.status === 'draft');
        } else if (activeFilter === 'confirmed') {
            filtered = filtered.filter((e) => e.status === 'confirmed');
        }

        // Apply search
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter((e) =>
                (e.estimate || '').toLowerCase().includes(s) ||
                (e.customerName || '').toLowerCase().includes(s) ||
                (e.proposalNo || '').toLowerCase().includes(s)
            );
        }

        // Sort: Drafts first, then by user selection (multi-level)
        filtered.sort((a, b) => {
            // 1. Draft priority
            const aIsDraft = draftIds.has(a._id);
            const bIsDraft = draftIds.has(b._id);

            if (aIsDraft && !bIsDraft) return -1;
            if (!aIsDraft && bIsDraft) return 1;

            // 2. User selected sort
            const { key, direction } = sortConfig;

            // Helper to get date value
            const getDateVal = (d: string | undefined) => {
                if (!d) return 0;
                const p = d.split('/');
                return p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[0]) - 1, parseInt(p[1])).getTime() : 0;
            };

            // Multi-level sort logic
            const compareValues = (key: string, dir: 'asc' | 'desc') => {
                let valA, valB;

                if (key === 'date') {
                    valA = getDateVal(a.date);
                    valB = getDateVal(b.date);
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    valA = (a as any)[key];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    valB = (b as any)[key];

                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = (valB || '').toLowerCase();
                }

                if (valA === valB) return 0;

                const comp = (valA || 0) > (valB || 0) ? 1 : -1;
                return dir === 'asc' ? comp : -comp;
            };

            // Primary Sort
            let result = compareValues(key, direction);
            if (result !== 0) return result;

            // Secondary Sorts (Only apply if primary is 'date')
            if (key === 'date') {
                // Secondary: Customer Name (Ascending)
                result = compareValues('customerName', 'asc');
                if (result !== 0) return result;

                // Tertiary: Version Number (Descending - newest version first)
                result = compareValues('versionNumber', 'desc');
            }

            return result;
        });

        return filtered;
    }, [visibleEstimates, activeFilter, search, draftIds, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 text-indigo-600 ml-1" />
            : <ArrowDown className="w-3 h-3 text-indigo-600 ml-1" />;
    };

    const totalPages = Math.ceil(filteredEstimates.length / itemsPerPage);
    const paginatedEstimates = filteredEstimates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const filterTabs = [
        { id: 'all', label: 'All', count: visibleEstimates.length },
        { id: 'thisMonth', label: 'This Month', count: visibleEstimates.filter((e) => isThisMonth(e.date || '')).length },
        { id: 'lastMonth', label: 'Last Month', count: visibleEstimates.filter((e) => isLastMonth(e.date || '')).length },
        { id: 'draft', label: 'Draft', count: visibleEstimates.filter((e) => e.status === 'draft').length },
        { id: 'confirmed', label: 'Confirmed', count: visibleEstimates.filter((e) => e.status === 'confirmed').length }
    ];

    const [isCreating, setIsCreating] = useState(false);
    const creatingRef = useRef(false);

    const handleCreate = async () => {
        if (creatingRef.current) return;
        creatingRef.current = true;
        setIsCreating(true);

        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'createEstimate', payload: {} })
            });
            const data = await res.json();
            if (data.success && data.result?._id) {
                // Keep locked during navigation
                success('Estimate created');
                const slug = data.result.estimate ? `${data.result.estimate}-V${data.result.versionNumber || 1}` : data.result._id;
                router.push(`/estimates/${slug}`);
            } else {
                toastError('Failed to create estimate');
                creatingRef.current = false;
                setIsCreating(false);
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to create estimate');
            creatingRef.current = false;
            setIsCreating(false);
        }
    };

    useAddShortcut(handleCreate);

    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteEstimate', payload: { id: deleteId } })
            });
            const data = await res.json();
            if (data.success) {
                success('Estimate deleted');
                fetchEstimates();
            } else {
                toastError('Failed to delete');
            }
        } catch {
            toastError('Failed to delete');
        }
        setIsConfirmOpen(false);
        setDeleteId(null);
    };

    const formatCurrency = (val: number | undefined) => {
        if (val === undefined || val === null) return '-';
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `;
    };

    return (
        <>
            <Header
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onEnter={() => {
                                if (filteredEstimates.length > 0) {
                                    const e = filteredEstimates[0];
                                    const slug = e.estimate ? `${e.estimate}-V${e.versionNumber || 1}` : e._id;
                                    router.push(`/estimates/${slug}`);
                                }
                            }}
                            placeholder="Search estimates..."
                        />
                        <AddButton onClick={handleCreate} disabled={isCreating} label={isCreating ? "Creating..." : "New Estimate"} />
                        <button
                            onClick={() => setShowKnowledgeBase(true)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Template Knowledge Base"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                }
            />
            <div className="p-4">

                {/* Filter Tabs & Toggle */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-4">
                    <BadgeTabs
                        tabs={filterTabs}
                        activeTab={activeFilter}
                        onChange={(id) => { setActiveFilter(id); setCurrentPage(1); }}
                    />

                    <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm h-[42px]">
                        <span className={`text-sm font-medium ${showFinals ? 'text-indigo-600' : 'text-gray-600'}`}>Finals</span>
                        <button
                            onClick={() => setShowFinals(!showFinals)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showFinals ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <span className={`${showFinals ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm`} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div>
                    {loading ? (
                        <SkeletonTable rows={10} columns={11} />
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader onClick={() => handleSort('estimate')} className="cursor-pointer hover:bg-gray-100 w-28 text-xs">
                                        <div className="flex items-center">Estimate<SortIcon column="estimate" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('versionNumber')} className="cursor-pointer hover:bg-gray-100 w-24 text-xs">
                                        <div className="flex items-center">Version<SortIcon column="versionNumber" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('date')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Date<SortIcon column="date" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('customerName')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Customer<SortIcon column="customerName" /></div>
                                    </TableHeader>
                                    <TableHeader className="text-xs">Services</TableHeader>
                                    <TableHeader onClick={() => handleSort('subTotal')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Sub Total<SortIcon column="subTotal" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('bidMarkUp')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Markup%<SortIcon column="bidMarkUp" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('margin')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Margin$<SortIcon column="margin" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('grandTotal')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Grand Total<SortIcon column="grandTotal" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Status<SortIcon column="status" /></div>
                                    </TableHeader>
                                    <TableHeader className="text-right text-xs">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedEstimates.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={11}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No estimates found</p>
                                                <p className="text-sm text-gray-500 mt-1">Create your first estimate to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedEstimates.map((est) => {
                                        const services = [
                                            { key: 'directionalDrilling', label: 'DD', color: 'bg-blue-500' },
                                            { key: 'excavationBackfill', label: 'EB', color: 'bg-green-500' },
                                            { key: 'hydroExcavation', label: 'HE', color: 'bg-purple-500' },
                                            { key: 'potholingCoring', label: 'PC', color: 'bg-orange-500' },
                                            { key: 'asphaltConcrete', label: 'AC', color: 'bg-red-500' }
                                        ].filter(s => est[s.key as keyof Estimate]);

                                        return (
                                            <TableRow
                                                key={est._id}
                                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => {
                                                    const slug = est.estimate ? `${est.estimate}-V${est.versionNumber || 1}` : est._id;
                                                    router.push(`/estimates/${slug}`);
                                                }}
                                            >
                                                <TableCell className="font-medium text-indigo-600 text-xs">
                                                    {est.estimate || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800 border border-gray-200 shadow-sm">
                                                        V.{est.versionNumber || 1}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-gray-500 text-xs">
                                                        {est.date || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{est.customerName || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {services.length > 0 ? services.map(s => (
                                                            <span
                                                                key={s.key}
                                                                className={`${s.color} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}
                                                                title={s.label}
                                                            >
                                                                {s.label}
                                                            </span>
                                                        )) : <span className="text-gray-400 text-xs">-</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium text-xs">
                                                    {formatCurrency(est.subTotal)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs font-medium text-gray-600">
                                                        {est.bidMarkUp ? String(est.bidMarkUp).replace('%', '') : '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-medium text-green-600 text-xs">
                                                    {formatCurrency(est.margin)}
                                                </TableCell>
                                                <TableCell className="font-bold text-gray-900 text-xs">
                                                    {formatCurrency(est.grandTotal)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={est.status === 'confirmed' ? 'success' : 'warning'}>
                                                        {est.status || 'draft'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div onClick={(e) => e.stopPropagation()} className="inline-flex">
                                                        <button
                                                            onClick={() => {
                                                                const slug = est.estimate ? `${est.estimate}-V${est.versionNumber || 1}` : est._id;
                                                                router.push(`/estimates/${slug}`);
                                                            }}
                                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(est._id)}
                                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 ml-1"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}

                            </TableBody>
                        </Table>
                    )}
                    <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                </div>

                {/* Confirm Delete Modal */}
                <ConfirmModal
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Estimate"
                    message="Are you sure you want to delete this estimate? This action cannot be undone."
                    confirmText="Delete"
                />

                {/* Knowledge Base Modal */}
                <Modal
                    isOpen={showKnowledgeBase}
                    onClose={() => setShowKnowledgeBase(false)}
                    title="Template Knowledge Base"
                >
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                            <h4 className="font-semibold text-blue-800 mb-2">How Templates Work</h4>
                            <p className="text-sm text-blue-600">
                                Templates allow you to generate proposal documents dynamically. Use the variables below in your template content, and they will be replaced with actual data from your estimate.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                Core Variables
                            </h4>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Variable</th>
                                            <th className="px-4 py-3 font-medium">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        <tr><td className="px-4 py-2 font-mono text-xs text-indigo-600">{`{{customerName}}`}</td><td className="px-4 py-2">Customer Name</td></tr>
                                        <tr><td className="px-4 py-2 font-mono text-xs text-indigo-600">{`{{projectTitle}}`}</td><td className="px-4 py-2">Project Title</td></tr>
                                        <tr><td className="px-4 py-2 font-mono text-xs text-indigo-600">{`{{date}}`}</td><td className="px-4 py-2">Estimate Date</td></tr>
                                        <tr><td className="px-4 py-2 font-mono text-xs text-indigo-600">{`{{proposalNo}}`}</td><td className="px-4 py-2">Proposal Number</td></tr>
                                        <tr><td className="px-4 py-2 font-mono text-xs text-indigo-600">{`{{aggregations.grandTotal}}`}</td><td className="px-4 py-2">Total Project Cost</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                Looping & Grouping
                            </h4>
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-900 text-gray-200 rounded-lg font-mono text-xs overflow-x-auto">
                                    <div className="mb-2 text-gray-500">// Basic List</div>
                                    {`<ul>`}
                                    <br />
                                    {`  {{#each lineItems.labor}}`}
                                    <br />
                                    {`    <li>{{classification}} - {{quantity}} days</li>`}
                                    <br />
                                    {`  {{/each}}`}
                                    <br />
                                    {`</ul>`}
                                </div>
                                <div className="p-4 bg-gray-900 text-gray-200 rounded-lg font-mono text-xs overflow-x-auto">
                                    <div className="mb-2 text-gray-500">// Grouped by Category</div>
                                    {`{{#each (groupBy lineItems.labor "classification")}}`}
                                    <br />
                                    {`  <h3>{{key}}</h3>`}
                                    <br />
                                    {`  <ul>`}
                                    <br />
                                    {`    {{#each this}}`}
                                    <br />
                                    {`      <li>{{subClassification}}: {{quantity}}</li>`}
                                    <br />
                                    {`    {{/each}}`}
                                    <br />
                                    {`  </ul>`}
                                    <br />
                                    {`{{/each}}`}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            </div>
        </>
    );
}
