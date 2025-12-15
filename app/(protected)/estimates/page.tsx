'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Eye, Calendar, User, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Header, AddButton, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, BadgeTabs, Pagination, EmptyState, Loading, Modal, ConfirmModal, Badge } from '@/components/ui';
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
    bidMarkUp?: string;
    grandTotal?: number;
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
    const [currentPage, setCurrentPage] = useState(1);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'updatedAt', direction: 'desc' });
    const itemsPerPage = 15;

    useEffect(() => {
        fetchEstimates();
        checkDrafts();
    }, []);

    const checkDrafts = () => {
        const drafts = new Set<string>();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('estimate_draft_')) {
                const id = key.replace('estimate_draft_', '');
                drafts.add(id);
            }
        }
        setDraftIds(drafts);
    };

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
            }
        } catch (err) {
            console.error('Error fetching estimates:', err);
        }
        setLoading(false);
    };

    // Filter helpers
    const isThisMonth = (dateStr: string) => {
        if (!dateStr) return false;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return false;
        const estDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        const now = new Date();
        return estDate.getMonth() === now.getMonth() && estDate.getFullYear() === now.getFullYear();
    };

    const isLastMonth = (dateStr: string) => {
        if (!dateStr) return false;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return false;
        const estDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return estDate.getMonth() === lastMonth.getMonth() && estDate.getFullYear() === lastMonth.getFullYear();
    };

    // Filter and search
    const filteredEstimates = useMemo(() => {
        let filtered = [...estimates];

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

        // Sort: Drafts first, then by user selection
        filtered.sort((a, b) => {
            // 1. Draft priority
            const aIsDraft = draftIds.has(a._id);
            const bIsDraft = draftIds.has(b._id);

            if (aIsDraft && !bIsDraft) return -1;
            if (!aIsDraft && bIsDraft) return 1;

            // 2. User selected sort
            const key = sortConfig.key as keyof Estimate;
            let aVal = a[key];
            let bVal = b[key];

            // Handle specific field types
            if (key === 'date') {
                // Convert MM/DD/YYYY to timestamps for comparison
                const getDate = (d: string | undefined) => {
                    if (!d) return 0;
                    const p = d.split('/');
                    return p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[0]) - 1, parseInt(p[1])).getTime() : 0;
                };
                aVal = getDate(a.date);
                bVal = getDate(b.date);
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = String(bVal || '').toLowerCase();
            }

            if (aVal === bVal) return 0;

            const comparison = (aVal || 0) > (bVal || 0) ? 1 : -1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [estimates, activeFilter, search, draftIds, sortConfig]);

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
        { id: 'all', label: 'All', count: estimates.length },
        { id: 'thisMonth', label: 'This Month', count: estimates.filter((e) => isThisMonth(e.date || '')).length },
        { id: 'lastMonth', label: 'Last Month', count: estimates.filter((e) => isLastMonth(e.date || '')).length },
        { id: 'draft', label: 'Draft', count: estimates.filter((e) => e.status === 'draft').length },
        { id: 'confirmed', label: 'Confirmed', count: estimates.filter((e) => e.status === 'confirmed').length }
    ];

    const handleCreate = async () => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'createEstimate', payload: {} })
            });
            const data = await res.json();
            if (data.success && data.result?._id) {
                success('Estimate created');
                router.push(`/estimates/${data.result._id}`);
            } else {
                toastError('Failed to create estimate');
            }
        } catch (err) {
            toastError('Failed to create estimate');
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
                                    router.push(`/estimates/${filteredEstimates[0]._id}`);
                                }
                            }}
                            placeholder="Search estimates..."
                        />
                        <AddButton onClick={handleCreate} label="New Estimate" />
                    </div>
                }
            />
            <div className="p-4">

                {/* Filter Tabs */}
                <div className="flex justify-center mb-4">
                    <BadgeTabs
                        tabs={filterTabs}
                        activeTab={activeFilter}
                        onChange={(id) => { setActiveFilter(id); setCurrentPage(1); }}
                    />
                </div>

                {/* Table */}
                <div>
                    {loading ? (
                        <Loading />
                    ) : (
                        <Table containerClassName="h-[calc(100vh-220px)] overflow-auto">
                            <TableHead>
                                <TableRow>
                                    <TableHeader onClick={() => handleSort('estimate')} className="cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center">Estimate #{<SortIcon column="estimate" />}</div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('customerName')} className="cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center">Customer{<SortIcon column="customerName" />}</div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('proposalNo')} className="cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center">Proposal #{<SortIcon column="proposalNo" />}</div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('date')} className="cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center">Date{<SortIcon column="date" />}</div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center">Status{<SortIcon column="status" />}</div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('grandTotal')} className="cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center">Total{<SortIcon column="grandTotal" />}</div>
                                    </TableHeader>
                                    <TableHeader className="text-right">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedEstimates.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={7}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No estimates found</p>
                                                <p className="text-sm text-gray-500 mt-1">Create your first estimate to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedEstimates.map((est) => (
                                        <TableRow key={est._id}>
                                            <TableCell className="font-medium text-indigo-600">
                                                <Link href={`/estimates/${est._id}`} className="hover:underline">
                                                    #{est.estimate}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{est.customerName || '-'}</TableCell>
                                            <TableCell>{est.proposalNo || '-'}</TableCell>
                                            <TableCell>
                                                <div className="text-gray-500 text-xs">
                                                    {est.date || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={est.status === 'confirmed' ? 'success' : 'warning'}>
                                                    {est.status || 'draft'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{formatCurrency(est.grandTotal)}</TableCell>
                                            <TableCell className="text-right">
                                                <div onClick={(e) => e.stopPropagation()} className="inline-flex">
                                                    <button
                                                        onClick={() => router.push(`/estimates/${est._id}`)}
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
                                    ))
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
            </div>
        </>
    );
}
