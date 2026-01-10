'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Eye, Calendar, User, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle, Upload } from 'lucide-react';

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
    services?: string[];
    fringe?: string;
    certifiedPayroll?: string;
    proposalWriter?: string;
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
    const [isImporting, setIsImporting] = useState(false);
    const [constants, setConstants] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const itemsPerPage = 15;

    const fetchEstimates = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEstimates' }),
                signal
            });
            const data = await res.json();
            if (data.success) {
                setEstimates(data.result || []);
            } else {
                toastError('Failed to fetch estimates');
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error(err);
            toastError('Failed to fetch estimates');
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
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
        const controller = new AbortController();
        fetchEstimates(controller.signal);

        // Fetch supporting data
        const fetchSupportingData = async () => {
            try {
                const [constRes, empRes] = await Promise.all([
                    fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getConstants' })
                    }),
                    fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getEmployees' })
                    })
                ]);
                const constData = await constRes.json();
                const empData = await empRes.json();
                if (constData.success) setConstants(constData.result);
                if (empData.success) setEmployees(empData.result);
            } catch (err) {
                console.error('Failed to fetch supporting data', err);
            }
        };

        fetchSupportingData();

        return () => controller.abort();
    }, []);

    const getBadgeProps = (category: string, value: string | undefined) => {
        if (!value) return { className: 'bg-gray-100 text-gray-800 border-gray-200' };

        const constant = constants.find(c => {
            const type = (c.type || c.category || '').toLowerCase();
            const searchCat = category.toLowerCase();
            return (type === searchCat || type.includes(searchCat)) &&
                (c.value?.toLowerCase() === value.toLowerCase() || c.description?.toLowerCase() === value.toLowerCase());
        });

        if (constant?.color) {
            return {
                style: { backgroundColor: constant.color, color: 'white', border: 'none' },
                className: 'shadow-sm'
            };
        }

        // Fallbacks if no constant color found
        const val = value.toLowerCase();
        if (category === 'Status') {
            switch (val) {
                case 'confirmed':
                case 'won': return { className: 'bg-green-100 text-green-800 border-green-200' };
                case 'pending': return { className: 'bg-orange-100 text-orange-800 border-orange-200' };
                case 'lost': return { className: 'bg-red-100 text-red-800 border-red-200' };
                case 'draft': return { className: 'bg-gray-100 text-gray-800 border-gray-200' };
            }
        }
        if (category === 'Fringe' || category === 'Certified Payroll') {
            if (val === 'yes') return { className: 'bg-[#0F4C75]/10 text-[#0F4C75] border-[#0F4C75]/20' };
        }

        return { className: 'bg-gray-100 text-gray-800 border-gray-200' };
    };

    const getEmployee = (email: string) => {
        return employees.find(e => e.email === email);
    };



    // Base filter: Finals (Latest Version) vs All
    // If showFinals is TRUE: only show latest version of each estimate.
    // If showFinals is FALSE: show ALL history.
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

        return Array.from(latestVersions.values());
    }, [estimates, showFinals]);

    // Filter and search on top of visibleEstimates
    const filteredEstimates = useMemo(() => {
        let filtered = [...visibleEstimates];

        // Apply date filter
        if (activeFilter === 'thisMonth') {
            filtered = filtered.filter((e) => isThisMonth(e.date || ''));
        } else if (activeFilter === 'lastMonth') {
            filtered = filtered.filter((e) => isLastMonth(e.date || ''));
        } else if (activeFilter === 'lost') {
            filtered = filtered.filter((e) => (e.status || '').toLowerCase() === 'lost');
        } else if (activeFilter === 'won') {
            filtered = filtered.filter((e) => (e.status || '').toLowerCase() === 'won' || (e.status || '').toLowerCase() === 'confirmed');
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

        // Sort strictly by user selection (multi-level)
        filtered.sort((a, b) => {
            // 1. User selected sort
            const { key, direction } = sortConfig;

            // Helper to get date value
            // Helper to get date value
            const getDateVal = (d: string | undefined): number => {
                if (!d) return 0;
                const t = Date.parse(d);
                if (!isNaN(t)) return t;
                const p = d.split(/[/.-]/);
                if (p.length === 3) {
                    let m = parseInt(p[0]);
                    let dy = parseInt(p[1]);
                    let yr = parseInt(p[2]);
                    if (yr < 100) yr += 2000;
                    return new Date(yr, m - 1, dy).getTime();
                }
                return 0;
            };

            // Natural sort comp
            const compareValues = (key: string, dir: 'asc' | 'desc') => {
                const valA = (a as any)[key];
                const valB = (b as any)[key];

                if (key === 'date') {
                    const timeA = getDateVal(valA);
                    const timeB = getDateVal(valB);
                    if (timeA === timeB) return 0;
                    return dir === 'asc' ? (timeA > timeB ? 1 : -1) : (timeA > timeB ? -1 : 1);
                }

                // String / Number sorting
                const strA = String(valA || '').toLowerCase();
                const strB = String(valB || '').toLowerCase();

                // Use localeCompare with numeric: true for natural sort (e.g. "2" < "10")
                const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
                return dir === 'asc' ? comp : -comp;
            };

            // Primary Sort
            let result = compareValues(key, direction);
            if (result !== 0) return result;

            // Secondary Sorts (Only apply if primary is 'date')
            if (key === 'date') {
                // Secondary: Customer Name (Ascending)
                const sec = compareValues('customerName', 'asc');
                if (sec !== 0) return sec;

                // Tertiary: Version Number (Descending - newest version first)
                const vA = (a.versionNumber || 0);
                const vB = (b.versionNumber || 0);
                return vB - vA;
            }

            return result;
        });

        return filtered;
    }, [visibleEstimates, activeFilter, search, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 text-[#0F4C75] ml-1" />
            : <ArrowDown className="w-3 h-3 text-[#0F4C75] ml-1" />;
    };

    const totalPages = Math.ceil(filteredEstimates.length / itemsPerPage);
    const paginatedEstimates = filteredEstimates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const filterTabs = [
        { id: 'all', label: 'All', count: visibleEstimates.length },
        { id: 'thisMonth', label: 'This Month', count: visibleEstimates.filter((e) => isThisMonth(e.date || '')).length },
        { id: 'lastMonth', label: 'Last Month', count: visibleEstimates.filter((e) => isLastMonth(e.date || '')).length },
        { id: 'lost', label: 'Lost', count: visibleEstimates.filter((e) => (e.status || '').toLowerCase() === 'lost').length },
        { id: 'won', label: 'Won', count: visibleEstimates.filter((e) => (e.status || '').toLowerCase() === 'won' || (e.status || '').toLowerCase() === 'confirmed').length }
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

    const parseCSV = (text: string) => {
        const rows: any[] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let insideQuotes = false;

        // Normalize line endings to \n to simplify
        const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        for (let i = 0; i < normalized.length; i++) {
            const char = normalized[i];
            const nextChar = normalized[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    i++; // Skip escape quote
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (char === '\n' && !insideQuotes) {
                currentRow.push(currentField.trim());
                if (currentRow.some(c => c)) rows.push(currentRow); // Only push non-empty rows
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
        // Push last row if exists
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            if (currentRow.some(c => c)) rows.push(currentRow);
        }
        return rows;
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                if (parsedRows.length < 2) throw new Error("Invalid CSV format or empty file");

                const headers = parsedRows[0].map((h: string) => h.replace(/^"|"$/g, '').trim());

                const estimatesData = parsedRows.slice(1).map(values => {
                    const item: any = {};
                    headers.forEach((h: string, i: number) => {
                        const key = h;
                        if (key && values[i] !== undefined) item[key] = values[i].replace(/^"|"$/g, '');
                    });
                    return item;
                });

                if (estimatesData.length === 0) throw new Error("No data found");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importEstimates', payload: { estimates: estimatesData } })
                });

                const data = await res.json();
                if (data.success) {
                    success(`Successfully imported/updated ${estimatesData.length} records`);
                    fetchEstimates();
                } else {
                    toastError('Import failed: ' + (data.error || 'Unknown error'));
                }
            } catch (err: any) {
                console.error(err);
                toastError('Error importing file: ' + err.message);
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };


    const formatCurrency = (val: number | undefined) => {

        if (val === undefined || val === null) return '-';
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
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
                        <button
                            onClick={handleCreate}
                            disabled={isCreating}
                            className="p-2.5 bg-[#0F4C75] text-white rounded-full hover:bg-[#0a3a5c] transition-all shadow-lg hover:shadow-[#0F4C75]/30 group"
                            title="New Estimate"
                        >
                            <Plus size={20} className={`duration-300 transition-transform ${isCreating ? 'animate-spin text-white/50' : 'group-hover:rotate-90'}`} />
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className={`p-2 rounded-lg transition-colors border ${isImporting ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-400 hover:text-[#0F4C75] hover:bg-[#0F4C75]/10 border-gray-200 hover:border-[#0F4C75]/30'}`}
                            title="Import from CSV"
                        >
                            <Upload className={`w-5 h-5 ${isImporting ? 'animate-pulse' : ''}`} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            accept=".csv"
                            className="hidden"
                        />

                    </div>
                }
            />
            </div>
            <div className="flex-1 overflow-y-auto pt-4 px-4 pb-0">

                {/* Filter Tabs & Toggle */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-4">
                    <BadgeTabs
                        tabs={filterTabs}
                        activeTab={activeFilter}
                        onChange={(id) => { setActiveFilter(id); setCurrentPage(1); }}
                    />

                    <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm h-[42px]">
                        <span className={`text-sm font-medium ${showFinals ? 'text-[#0F4C75]' : 'text-gray-600'}`}>Finals</span>
                        <button
                            onClick={() => setShowFinals(!showFinals)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F4C75] focus:ring-offset-2 ${showFinals ? 'bg-[#0F4C75]' : 'bg-gray-200'}`}
                        >
                            <span className={`${showFinals ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm`} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div>
                    {loading ? (
                        <SkeletonTable rows={10} columns={14} />
                    ) : (
                        <Table
                            footer={
                                <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                            }
                        >
                            <TableHead>
                                <TableRow>
                                    <TableHeader onClick={() => handleSort('estimate')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Estimate<SortIcon column="estimate" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('versionNumber')} className="cursor-pointer hover:bg-gray-100 w-16 text-xs">
                                        <div className="flex items-center">V.<SortIcon column="versionNumber" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('date')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Date<SortIcon column="date" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('customerName')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Customer<SortIcon column="customerName" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('proposalWriter')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        Writer
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('fringe')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        Fringe
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('certifiedPayroll')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        CP
                                    </TableHeader>
                                    <TableHeader className="text-xs">Services</TableHeader>
                                    <TableHeader onClick={() => handleSort('subTotal')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Sub<SortIcon column="subTotal" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('bidMarkUp')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">%<SortIcon column="bidMarkUp" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('margin')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Margin<SortIcon column="margin" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('grandTotal')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Total<SortIcon column="grandTotal" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-100 text-xs">
                                        <div className="flex items-center">Status<SortIcon column="status" /></div>
                                    </TableHeader>
                                    <TableHeader className="text-left text-xs">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedEstimates.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={14}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No estimates found</p>
                                                <p className="text-sm text-gray-500 mt-1">Create your first estimate to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedEstimates.map((est) => {
                                        const services = [
                                            { value: 'Directional Drilling', label: 'DD', color: 'bg-blue-500' },
                                            { value: 'Excavation & Backfill', label: 'EB', color: 'bg-green-500' },
                                            { value: 'Hydro-excavation', label: 'HE', color: 'bg-purple-500' },
                                            { value: 'Potholing & Coring', label: 'PC', color: 'bg-orange-500' },
                                            { value: 'Asphalt & Concrete', label: 'AC', color: 'bg-red-500' }
                                        ].filter(s => est.services?.includes(s.value));


                                        return (
                                            <TableRow
                                                key={est._id}
                                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => {
                                                    const slug = est.estimate ? `${est.estimate}-V${est.versionNumber || 1}` : est._id;
                                                    router.push(`/estimates/${slug}`);
                                                }}
                                            >
                                                <TableCell className="font-medium text-gray-900 text-xs">
                                                    {est.estimate || '-'}
                                                </TableCell>
                                                <TableCell>
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
                                                    <div className="flex">
                                                        {est.proposalWriter ? (
                                                            getEmployee(est.proposalWriter)?.profilePicture ? (
                                                                <img
                                                                    src={getEmployee(est.proposalWriter)!.profilePicture}
                                                                    alt={est.proposalWriter}
                                                                    className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                                                                    title={est.proposalWriter}
                                                                />
                                                            ) : (
                                                                <div
                                                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 border border-gray-200"
                                                                    title={est.proposalWriter}
                                                                >
                                                                    {est.proposalWriter.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 border-dashed" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {est.fringe && (
                                                        <Badge {...getBadgeProps('Fringe', est.fringe)}>
                                                            {est.fringe}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {est.certifiedPayroll && (
                                                        <Badge {...getBadgeProps('Certified Payroll', est.certifiedPayroll)}>
                                                            {est.certifiedPayroll}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {services.length > 0 ? services.map(s => (
                                                            <span
                                                                key={s.value}
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
                                                    <Badge {...getBadgeProps('Status', est.status || 'draft')}>
                                                        {est.status || 'draft'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-left">
                                                    <div onClick={(e) => e.stopPropagation()} className="inline-flex">
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
                </div>

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
                                <span className="bg-[#0F4C75]/10 text-[#0F4C75] w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                Core Variables
                            </h4>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
                                        <tr>
                                            <th className="p-1 font-medium">Variable</th>
                                            <th className="p-1 font-medium">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        <tr><td className="p-1 font-mono text-xs text-[#0F4C75]">{`{{customerName}}`}</td><td className="p-1">Customer Name</td></tr>
                                        <tr><td className="p-1 font-mono text-xs text-[#0F4C75]">{`{{projectTitle}}`}</td><td className="p-1">Project Title</td></tr>
                                        <tr><td className="p-1 font-mono text-xs text-[#0F4C75]">{`{{date}}`}</td><td className="p-1">Estimate Date</td></tr>
                                        <tr><td className="p-1 font-mono text-xs text-[#0F4C75]">{`{{proposalNo}}`}</td><td className="p-1">Proposal Number</td></tr>
                                        <tr><td className="p-1 font-mono text-xs text-[#0F4C75]">{`{{aggregations.grandTotal}}`}</td><td className="p-1">Total Project Cost</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="bg-[#0F4C75]/10 text-[#0F4C75] w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
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
    );
}
