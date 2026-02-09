'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Calendar, User, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle, Upload, Loader2, Lock } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, parse, isValid, isWithinInterval } from 'date-fns';

import { z } from 'zod';

import { Header, AddButton, Button, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, LabeledSwitch, Pagination, EmptyState, Loading, Modal, ConfirmModal, Badge, SkeletonTable, Tooltip, TooltipTrigger, TooltipContent, MyDropDown } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, BadgeTabs } from '@/components/ui/Tabs';
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
    projectName?: string;
    services?: string[];
    fringe?: string;
    certifiedPayroll?: string;
    proposalWriter?: string | string[];
    isChangeOrder?: boolean;
    parentVersionId?: string;
    createdAt?: string;
    updatedAt?: string;
    syncedToAppSheet?: boolean;
    signedContracts?: any[];
}


const searchSchema = z.string().max(100, "Search query too long");

export default function EstimatesPage() {
    const router = useRouter();
    const { toasts, success, error: toastError, removeToast } = useToast();

    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [showFinals, setShowFinals] = useState(true);
    const [showChangeOrders, setShowChangeOrders] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('devco_user') || '{}');
        setCurrentUserEmail(user?.email || null);
    }, []);
    const [visibleCount, setVisibleCount] = useState(15);
    const observerTarget = useRef(null);

    const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);

    const [constants, setConstants] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
    const [wonConfirmationId, setWonConfirmationId] = useState<string | null>(null);



    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'estimate', direction: 'desc' });
    const itemsPerPage = 15;

    // Pagination State
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);

    // Debounced Search & Filter Effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Reset to page 1 on search/filter change
            fetchEstimates(1, false);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [search, activeFilter]);

    const fetchEstimates = async (pageToFetch = 1, isLoadMore = false) => {
        if (isLoadMore) setIsFetchingMore(true);
        else setLoading(true);

        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getEstimates',
                    payload: { 
                        page: pageToFetch, 
                        limit: 30, 
                        search, 
                        filter: activeFilter 
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                const newEstimates = data.result || [];
                
                if (isLoadMore) {
                    setEstimates(prev => {
                        const ids = new Set(prev.map(e => e._id));
                        const uniqueNew = newEstimates.filter((e: any) => !ids.has(e._id));
                        return [...prev, ...uniqueNew];
                    });
                } else {
                    setEstimates(newEstimates);
                }

                // Store aggregated filter counts from server
                if (data.filterCounts) {
                    setFilterCounts(data.filterCounts);
                }

                setHasMore(newEstimates.length >= 30);
                setPage(pageToFetch);
            } else {
                toastError('Failed to fetch estimates');
            }
        } catch (err: any) {
            console.error(err);
            toastError('Failed to fetch estimates');
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    };

    // Infinite Scroll Observer Trigger
    const lastEstimateRef = useCallback((node: HTMLDivElement) => {
        if (loading || isFetchingMore) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchEstimates(page + 1, true);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, isFetchingMore, hasMore, page, search, activeFilter]);

        
    const statusOptions = useMemo(() => {
        return constants
            .filter((c: any) => {
                const type = (c.type || c.category || '').toLowerCase();
                return type === 'estimate status';
            })
            .map((c: any) => ({
                id: c._id,
                label: c.description || c.value,
                value: c.description || c.value,
                color: c.color
            }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [constants]);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        // Find original item to allow revert on failure
        const item = estimates.find(e => e._id === id);
        if (!item) return;

        // Apply rules
        if (newStatus === 'Won') {
            if (!item.fringe) {
                toastError("Please select a Fringe Rate in the estimate details first.");
                return;
            }
            if (!item.signedContracts || item.signedContracts.length === 0) {
                toastError("Please upload a Signed Contract in the estimate details first.");
                return;
            }
            setWonConfirmationId(id);
            setStatusDropdownId(null);
            return;
        }

        if (newStatus === 'Completed' && item.status !== 'Won') {
            toastError("Estimate must be Won before marking as Completed");
            return;
        }

        const originalStatus = item.status;

        // 1. Optimistic UI Update
        setEstimates(prev => prev.map(e => e._id === id ? { ...e, status: newStatus } : e));
        setStatusDropdownId(null); // Close dropdown immediately

        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateEstimate', 
                    payload: { 
                        id, 
                        status: newStatus,
                        updatedBy: currentUserEmail 
                    } 
                })
            });
            const data = await res.json();
            if (data.success) {
                success('Status updated');
            } else {
                // Revert if backend says failure
                setEstimates(prev => prev.map(e => e._id === id ? { ...e, status: originalStatus } : e));
                toastError('Failed to update status');
            }
        } catch (err) {
            console.error(err);
            // Revert on network error
            setEstimates(prev => prev.map(e => e._id === id ? { ...e, status: originalStatus } : e));
            toastError('Error updating status');
        }
    };

    const parseDate = (d: string) => {
        if (!d) return null;
        // Try different formats
        const formats = ['MM/dd/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'];
        for (const format of formats) {
            const parsed = parse(d, format, new Date());
            if (isValid(parsed)) return parsed;
        }
        return null;
    };

    const isThisMonth = (d: string) => {
        const date = parseDate(d);
        if (!date) return false;
        const now = new Date();
        const thisMonthStart = startOfMonth(now);
        const thisMonthEnd = endOfMonth(now);
        return isWithinInterval(date, { start: thisMonthStart, end: thisMonthEnd });
    };

    const isLastMonth = (d: string) => {
        const date = parseDate(d);
        if (!date) return false;
        const now = new Date();
        const lastMonth = subMonths(now, 1);
        const lastMonthStart = startOfMonth(lastMonth);
        const lastMonthEnd = endOfMonth(lastMonth);
        return isWithinInterval(date, { start: lastMonthStart, end: lastMonthEnd });
    };

    // Initial Load of Supporting Data
    useEffect(() => {
        const controller = new AbortController();
        
        const fetchSupportingData = async () => {
            try {
                const [constRes, empRes, clientRes] = await Promise.all([
                    fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getConstants' })
                    }),
                    fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getEmployees' })
                    }),
                    fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getClients' })
                    })
                ]);
                const constData = await constRes.json();
                const empData = await empRes.json();
                const clientData = await clientRes.json();
                if (constData.success) setConstants(constData.result);
                if (empData.success) setEmployees(empData.result);
                if (clientData.success) setClients(clientData.result);
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

    const getCustomerName = (est: Estimate) => {
        if (est.customerName) return est.customerName;
        if (est.customerId) {
            const client = clients.find(c => c._id === est.customerId);
            return client ? client.name : '-';
        }
        return '-';
    };



    // Base filter: Finals (Latest Version) vs All
    // If showFinals is TRUE: only show latest/final version of each estimate.
    // If showFinals is FALSE: show ALL versions/history.
    const filteredEstimates = useMemo(() => {
        let filtered = [...estimates];

        // When Finals toggle is ON, only show the highest version of each estimate
        if (showFinals) {
            // Group estimates by their base estimate number
            const groupedByEstimate = new Map<string, Estimate[]>();
            
            filtered.forEach(est => {
                const baseEstimate = est.estimate || est._id;
                if (!groupedByEstimate.has(baseEstimate)) {
                    groupedByEstimate.set(baseEstimate, []);
                }
                groupedByEstimate.get(baseEstimate)!.push(est);
            });

            // For each group, keep only the highest version number
            filtered = [];
            groupedByEstimate.forEach(group => {
                if (group.length === 1) {
                    filtered.push(group[0]);
                } else {
                    // Find the one with the highest version number
                    const highest = group.reduce((max, current) => {
                        const maxVersion = max.versionNumber || 1;
                        const currentVersion = current.versionNumber || 1;
                        return currentVersion > maxVersion ? current : max;
                    });
                    filtered.push(highest);
                }
            });
        }

        // Sort strictly by user selection (multi-level)
        filtered.sort((a, b) => {
            // 1. User selected sort
            const { key, direction } = sortConfig;

            // Helper to get date value
            const getDateVal = (d: string | undefined): number => {
                if (!d) return 0;
                const parsed = parseDate(d);
                return parsed ? parsed.getTime() : 0;
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

            return compareValues(key, direction);
        });

        return filtered;
    }, [estimates, sortConfig, showFinals]);

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

    // NO slicing, infinite scroll instead
    const paginatedEstimates = filteredEstimates;

    const filterTabs = [
        { id: 'all', label: 'All', count: filterCounts.all ?? 0 },
        { id: 'thisMonth', label: 'This Month', count: filterCounts.thisMonth ?? 0 },
        { id: 'lastMonth', label: 'Last Month', count: filterCounts.lastMonth ?? 0 },
        { id: 'pending', label: 'Pending', count: filterCounts.pending ?? 0 },
        { id: 'completed', label: 'Completed', count: filterCounts.completed ?? 0 },
        { id: 'won', label: 'Won', count: filterCounts.won ?? 0 },
        { id: 'lost', label: 'Lost', count: filterCounts.lost ?? 0 }
    ];

    const [isCreating, setIsCreating] = useState(false);
    const creatingRef = useRef(false);

    const handleCreate = async () => {
        if (creatingRef.current) return;
        creatingRef.current = true;
        setIsCreating(true);

        try {
            // Get current user from localStorage
            const currentUser = typeof window !== 'undefined' 
                ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email 
                : null;

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'createEstimate', 
                    payload: { 
                        proposalWriter: currentUser,
                        createdBy: currentUser 
                    } 
                })
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









    const [syncingId, setSyncingId] = useState<string | null>(null);

    const handleSyncToAppSheet = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent row click
        setSyncingId(id);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'syncToAppSheet', payload: { id } })
            });
            const data = await res.json();
            if (data.success) {
                success('Estimate synced to AppSheet!');
                // Update local state to hide button
                setEstimates(prev => prev.map(est => est._id === id ? { ...est, syncedToAppSheet: true } : est));
            } else {
                toastError(data.error || 'Sync failed');
            }
        } catch (err) {
            console.error(err);
            toastError('Sync failed');
        } finally {
            setSyncingId(null);
        }
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
                            onChange={(e) => {
                                const result = searchSchema.safeParse(e.target.value);
                                if (result.success) {
                                    setSearch(result.data);
                                } else {
                                    console.warn('Invalid search input:', result.error.message);
                                    setSearch(e.target.value); // Still allow but warn
                                }
                            }}
                            onEnter={() => {
                                if (filteredEstimates.length > 0) {
                                    const e = filteredEstimates[0];
                                    const slug = e.estimate ? `${e.estimate}-V${e.versionNumber || 1}` : e._id;
                                    router.push(`/estimates/${slug}`);
                                }
                            }}
                            placeholder="Search any field..."
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                    className="p-2.5 bg-[#0F4C75] text-white rounded-full hover:bg-[#0a3a5c] transition-all shadow-lg hover:shadow-[#0F4C75]/30 group"
                                >
                                    <Plus size={20} className={`duration-300 transition-transform ${isCreating ? 'animate-spin text-white/50' : 'group-hover:rotate-90'}`} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>New Estimate</p>
                            </TooltipContent>
                        </Tooltip>


                    </div>
                }
            />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4">

                {/* Filter Tabs & Toggle */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-2">
                    <div className="hidden lg:block">
                        <Tabs 
                            value={activeFilter} 
                            onValueChange={(val) => { setActiveFilter(val); }}
                            className="scale-90 origin-center"
                        >
                            <TabsList className="h-10 p-1">
                                {filterTabs.map(tab => (
                                    <TabsTrigger 
                                        key={tab.id} 
                                        value={tab.id}
                                        className="px-4 py-1 text-xs font-bold"
                                    >
                                        {tab.label}
                                        {tab.count !== undefined && (
                                            <span className="ml-1 opacity-50 font-bold tabular-nums">({tab.count})</span>
                                        )}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex gap-2">
                        <LabeledSwitch
                            label="Finals"
                            checked={showFinals}
                            onCheckedChange={setShowFinals}
                            className="scale-90 origin-center"
                        />
                        <LabeledSwitch
                            label="Change Orders"
                            checked={showChangeOrders}
                            onCheckedChange={setShowChangeOrders}
                            className="scale-90 origin-center"
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 pb-4 overflow-y-auto">
                    {loading ? (
                        <>
                            {/* Mobile Loading Skeleton */}
                            <div className="lg:hidden space-y-3 pb-8">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                                ))}
                            </div>
                            {/* Desktop Loading Skeleton */}
                            <div className="hidden lg:block h-full">
                                <SkeletonTable rows={10} columns={13} className="h-full" />
                            </div>
                        </>
                    ) : (
                        <>
                        {/* ===== MOBILE CARD VIEW ===== */}
                        <div className="lg:hidden space-y-3 pb-8">
                            {paginatedEstimates.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-slate-500 font-medium">No estimates found</p>
                                    <p className="text-sm text-slate-400 mt-1">Create your first estimate to get started.</p>
                                </div>
                            ) : (
                                paginatedEstimates.map((est, index) => {
                                    const services = [
                                        { value: 'Directional Drilling', label: 'DD', color: 'bg-blue-500' },
                                        { value: 'Excavation & Backfill', label: 'EB', color: 'bg-green-500' },
                                        { value: 'Hydro-excavation', label: 'HE', color: 'bg-purple-500' },
                                        { value: 'Potholing & Coring', label: 'PC', color: 'bg-orange-500' },
                                        { value: 'Asphalt & Concrete', label: 'AC', color: 'bg-red-500' }
                                    ].filter(s => est.services?.includes(s.value));

                                    const writers = Array.isArray(est.proposalWriter)
                                        ? est.proposalWriter
                                        : est.proposalWriter ? [est.proposalWriter] : [];

                                    const isLast = index === paginatedEstimates.length - 1;

                                    return (
                                        <div
                                            key={est._id}
                                            ref={isLast ? lastEstimateRef : undefined}
                                            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all"
                                            onClick={() => {
                                                const slug = est.estimate ? `${est.estimate}-V${est.versionNumber || 1}` : est._id;
                                                router.push(`/estimates/${slug}`);
                                            }}
                                        >
                                            {/* Top Row: Est # + Status */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                        {est.estimate || '-'}
                                                    </span>
                                                    {!showFinals && (
                                                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                            V.{est.versionNumber || 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <Badge
                                                    {...getBadgeProps('Status', est.status || 'draft')}
                                                    className="text-[10px] px-2 py-0.5 flex items-center gap-1"
                                                >
                                                    {['Won', 'Completed'].includes(est.status || '') && (
                                                        <Lock className="w-2.5 h-2.5" />
                                                    )}
                                                    {est.status || 'Draft'}
                                                </Badge>
                                            </div>

                                            {/* Project Name */}
                                            <h3 className="font-bold text-slate-800 text-sm line-clamp-1 leading-tight mb-1">
                                                {est.projectName || 'Untitled Project'}
                                            </h3>

                                            {/* Customer + Date */}
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[11px] text-slate-500 truncate max-w-[60%]">
                                                    {getCustomerName(est)}
                                                </p>
                                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {est.date || '-'}
                                                </p>
                                            </div>

                                            {/* Bottom Row: Amount + Services + Writer */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    {/* Grand Total */}
                                                    <span className="text-sm font-black text-slate-800">
                                                        {formatCurrency(est.grandTotal)}
                                                    </span>
                                                    {/* Markup */}
                                                    {est.bidMarkUp && (
                                                        <span className="text-[10px] font-medium text-slate-400">
                                                            {String(est.bidMarkUp).replace('%', '')}%
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Service Tags */}
                                                    {services.length > 0 && (
                                                        <div className="flex gap-0.5">
                                                            {services.map(s => (
                                                                <span
                                                                    key={s.value}
                                                                    className={`${s.color} text-white text-[8px] font-bold px-1 py-0.5 rounded`}
                                                                >
                                                                    {s.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Writer Avatars */}
                                                    <div className="flex -space-x-1.5">
                                                        {writers.slice(0, 2).map((writer, idx) => {
                                                            const emp = getEmployee(writer);
                                                            return emp?.profilePicture ? (
                                                                <img
                                                                    key={idx}
                                                                    src={emp.profilePicture}
                                                                    alt=""
                                                                    className="w-6 h-6 rounded-full border-2 border-white object-cover"
                                                                />
                                                            ) : (
                                                                <div
                                                                    key={idx}
                                                                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500 border-2 border-white"
                                                                >
                                                                    {writer.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Mobile infinite scroll trigger */}
                            {hasMore && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                </div>
                            )}
                        </div>

                        {/* ===== DESKTOP TABLE VIEW ===== */}
                        <div className="hidden lg:block h-full">
                        <Table
                            containerClassName="h-full"
                            footer={
                                <div className="flex flex-col items-center justify-center p-2 text-xs text-gray-500 w-full">
                                    <span>
                                        Showing {paginatedEstimates.length} records {hasMore ? '(Loading more...)' : ''}
                                    </span>
                                </div>
                            }
                        >
                            <TableHead>
                                <TableRow>
                                    <TableHeader onClick={() => handleSort('estimate')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-20">
                                        <div className="flex items-center">Est.<SortIcon column="estimate" /></div>
                                    </TableHeader>
                                    {!showFinals && (
                                        <TableHeader onClick={() => handleSort('versionNumber')} className="cursor-pointer hover:bg-gray-100 w-12 text-[10px]">
                                            <div className="flex items-center">V.<SortIcon column="versionNumber" /></div>
                                        </TableHeader>
                                    )}
                                    <TableHeader onClick={() => handleSort('projectName')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-32">
                                        <div className="flex items-center">Project<SortIcon column="projectName" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('date')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-20">
                                        <div className="flex items-center">Date<SortIcon column="date" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('customerName')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-40">
                                        <div className="flex items-center">Customer<SortIcon column="customerName" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('proposalWriter')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-12 text-center">
                                        Writer
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('fringe')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-16">
                                        Fringe
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('certifiedPayroll')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-10">
                                        CP
                                    </TableHeader>
                                    <TableHeader className="text-[10px] w-20">Services</TableHeader>
                                    <TableHeader onClick={() => handleSort('subTotal')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-20">
                                        <div className="flex items-center">Sub<SortIcon column="subTotal" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('bidMarkUp')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-10">
                                        <div className="flex items-center">%<SortIcon column="bidMarkUp" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('margin')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-20">
                                        <div className="flex items-center">Margin<SortIcon column="margin" /></div>
                                    </TableHeader>
                                    <TableHeader onClick={() => handleSort('grandTotal')} className="cursor-pointer hover:bg-gray-100 text-[9px] w-24 whitespace-nowrap">
                                        <div className="flex items-center">Org. Cont<SortIcon column="grandTotal" /></div>
                                    </TableHeader>
                                    <TableHeader className="text-[9px] w-20 whitespace-nowrap">Chg. Order</TableHeader>
                                    <TableHeader className="text-[9px] w-24 whitespace-nowrap">Upd. Contract</TableHeader>
                                    <TableHeader onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-100 text-[10px] w-20">
                                        <div className="flex items-center">Status<SortIcon column="status" /></div>
                                    </TableHeader>
                                    {currentUserEmail === 'adeel@devco-inc.com' && (
                                        <TableHeader className="w-8">
                                            <span className="sr-only">Sync</span>
                                        </TableHeader>
                                    )}

                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedEstimates.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={20}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No estimates found</p>
                                                <p className="text-sm text-gray-500 mt-1">Create your first estimate to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedEstimates.map((est, index) => {
                                        const services = [
                                            { value: 'Directional Drilling', label: 'DD', color: 'bg-blue-500' },
                                            { value: 'Excavation & Backfill', label: 'EB', color: 'bg-green-500' },
                                            { value: 'Hydro-excavation', label: 'HE', color: 'bg-purple-500' },
                                            { value: 'Potholing & Coring', label: 'PC', color: 'bg-orange-500' },
                                            { value: 'Asphalt & Concrete', label: 'AC', color: 'bg-red-500' }
                                        ].filter(s => est.services?.includes(s.value));

                                        const isLast = index === paginatedEstimates.length - 1;

                                        return (
                                            <TableRow
                                                key={est._id}
                                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => {
                                                    const slug = est.estimate ? `${est.estimate}-V${est.versionNumber || 1}` : est._id;
                                                    router.push(`/estimates/${slug}`);
                                                }}
                                            >
                                                <TableCell className="font-medium text-gray-900 text-[10px] whitespace-nowrap">
                                                    <div ref={isLast ? lastEstimateRef : undefined}>
                                                        {est.estimate || '-'}
                                                    </div>
                                                </TableCell>
                                                {!showFinals && (
                                                    <TableCell>
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-800 border border-gray-200 shadow-sm">
                                                            V.{est.versionNumber || 1}
                                                        </span>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-[10px] max-w-[120px]">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="truncate font-medium text-[#0F4C75]">{est.projectName || '-'}</div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{est.projectName || 'No Project Name'}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-gray-500 text-[10px] whitespace-nowrap">
                                                        {est.date || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-[10px] max-w-[140px]">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="truncate">{getCustomerName(est)}</div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{getCustomerName(est)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex -space-x-2">
                                                        {(() => {
                                                            const writers = Array.isArray(est.proposalWriter) 
                                                                ? est.proposalWriter 
                                                                : est.proposalWriter ? [est.proposalWriter] : [];
                                                                
                                                            if (writers.length === 0) {
                                                                return <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 border-dashed" />;
                                                            }

                                                            return writers.slice(0, 4).map((writer, idx) => {
                                                                const emp = getEmployee(writer);
                                                                return (
                                                                    <div key={idx} className="relative z-0 hover:z-10 transition-all">
                                                                        {emp?.profilePicture ? (
                                                                            <img
                                                                                src={emp.profilePicture}
                                                                                alt={writer}
                                                                                className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm"
                                                                                title={writer}
                                                                            />
                                                                        ) : (
                                                                            <div
                                                                                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 border-2 border-white shadow-sm"
                                                                                title={writer}
                                                                            >
                                                                                {writer.substring(0, 2).toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                        {Array.isArray(est.proposalWriter) && est.proposalWriter.length > 4 && (
                                                            <div className="relative z-0 hover:z-10 transition-all">
                                                                 <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 border-2 border-white shadow-sm">
                                                                    +{est.proposalWriter.length - 4}
                                                                 </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {est.fringe && (
                                                        <Badge {...getBadgeProps('Fringe', est.fringe)} className="text-[10px] px-2 py-0">
                                                            {est.fringe}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {est.certifiedPayroll && (
                                                        <Badge {...getBadgeProps('Certified Payroll', est.certifiedPayroll)} className="text-[10px] px-2 py-0">
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
                                                        )) : <span className="text-gray-400 text-[10px]">-</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium text-[10px] whitespace-nowrap">
                                                    {formatCurrency(est.subTotal)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-[10px] font-medium text-gray-600">
                                                        {est.bidMarkUp ? String(est.bidMarkUp).replace('%', '') : '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-medium text-green-600 text-[10px] whitespace-nowrap">
                                                    {formatCurrency(est.margin)}
                                                </TableCell>
                                                <TableCell className="font-bold text-gray-900 text-[9px] whitespace-nowrap">
                                                    {formatCurrency(est.grandTotal)}
                                                </TableCell>
                                                <TableCell className="font-medium text-amber-600 text-[9px] whitespace-nowrap">
                                                    {(() => {
                                                        const coTotal = estimates
                                                            .filter(e => e.estimate === est.estimate && e.isChangeOrder)
                                                            .reduce((sum, e) => sum + (e.grandTotal || 0), 0);
                                                        return formatCurrency(coTotal);
                                                    })()}
                                                </TableCell>
                                                <TableCell className="font-bold text-blue-900 text-[9px] whitespace-nowrap">
                                                    {(() => {
                                                        const coTotal = estimates
                                                            .filter(e => e.estimate === est.estimate && e.isChangeOrder)
                                                            .reduce((sum, e) => sum + (e.grandTotal || 0), 0);
                                                        return formatCurrency((est.grandTotal || 0) + coTotal);
                                                    })()}
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <div className="relative">
                                                        <div 
                                                            id={`status-trigger-${est._id}`}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setStatusDropdownId(statusDropdownId === est._id ? null : est._id);
                                                            }}
                                                        >
                                                            <Badge 
                                                                {...getBadgeProps('Status', est.status || 'draft')} 
                                                                className="text-[10px] px-2 py-0 cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                                                            >
                                                                {['Won', 'Completed'].includes(est.status || '') && (
                                                                    <Lock className="w-2.5 h-2.5" />
                                                                )}
                                                                {est.status || 'draft'}
                                                            </Badge>
                                                        </div>
                                                        <MyDropDown
                                                            isOpen={statusDropdownId === est._id}
                                                            onClose={() => setStatusDropdownId(null)}
                                                            anchorId={`status-trigger-${est._id}`}
                                                            options={statusOptions.map(opt => ({
                                                                ...opt,
                                                                disabled: (opt.value === 'Completed' && est.status !== 'Won') || 
                                                                          (['Won', 'Completed'].includes(est.status || '') && opt.value !== est.status && !(est.status === 'Won' && opt.value === 'Completed')),
                                                                tooltip: opt.value === 'Completed' && est.status !== 'Won' 
                                                                    ? 'Must be Won first' 
                                                                    : (['Won', 'Completed'].includes(est.status || '') && opt.value !== est.status && !(est.status === 'Won' && opt.value === 'Completed'))
                                                                        ? 'Status is locked'
                                                                        : undefined
                                                            }))}
                                                            selectedValues={est.status ? [est.status] : []}
                                                            onSelect={(val) => handleStatusUpdate(est._id, val)}
                                                            width="w-40"
                                                            positionMode="bottom"
                                                            showSearch={false}
                                                            transparentBackdrop={true}
                                                        />
                                                    </div>
                                                </TableCell>
                                                {currentUserEmail === 'adeel@devco-inc.com' && (
                                                    <TableCell>
                                                        <button 
                                                               onClick={(e) => handleSyncToAppSheet(e, est._id)}
                                                               disabled={syncingId === est._id}
                                                               className={`p-1 px-2 rounded transition-colors disabled:opacity-50 ${est.syncedToAppSheet ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                                               title={est.syncedToAppSheet ? "Update AppSheet" : "Sync to AppSheet"}
                                                           >
                                                               {syncingId === est._id ? (
                                                                   <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                               ) : (
                                                                   <Upload className="w-3.5 h-3.5" />
                                                               )}
                                                           </button>
                                                    </TableCell>
                                                )}

                                            </TableRow>
                                        );
                                    })
                                )}
                                {visibleCount < filteredEstimates.length && (
                                     <TableRow>
                                        <TableCell colSpan={20} className="p-0 border-none">
                                            <div ref={observerTarget} className="h-4 w-full" />
                                        </TableCell>
                                     </TableRow>
                                )}

                            </TableBody>
                        </Table>
                        </div>
                        </>
                    )}
                </div>

                </div>



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

                {/* Won Status Confirmation Modal */}
                <Modal
                    isOpen={!!wonConfirmationId}
                    onClose={() => setWonConfirmationId(null)}
                    title="Confirm Job Win"
                    footer={(
                        <div className="flex justify-end gap-3 w-full">
                            <Button variant="ghost" onClick={() => setWonConfirmationId(null)}>Cancel</Button>
                            <Button 
                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={async () => {
                                    const id = wonConfirmationId!;
                                    const item = estimates.find(e => e._id === id);
                                    if (!item) return;
                                    const originalStatus = item.status;
                                    
                                    // Optimistic
                                    setEstimates(prev => prev.map(e => e._id === id ? { ...e, status: 'Won' } : e));
                                    setWonConfirmationId(null);

                                    try {
                                        const res = await fetch('/api/webhook/devcoBackend', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ 
                                                action: 'updateEstimate', 
                                                payload: { 
                                                    id, 
                                                    status: 'Won',
                                                    updatedBy: currentUserEmail 
                                                } 
                                            })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            success("Status updated to Won! Fringe Rate Locked.");
                                        } else {
                                            setEstimates(prev => prev.map(e => e._id === id ? { ...e, status: originalStatus } : e));
                                            toastError('Failed to update status');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        setEstimates(prev => prev.map(e => e._id === id ? { ...e, status: originalStatus } : e));
                                        toastError('Error updating status');
                                    }
                                }}
                            >
                                Confirm & Lock
                            </Button>
                        </div>
                    )}
                >
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                            <Plus className="w-8 h-8 text-emerald-600" />
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-slate-800">
                                Congratulations on the Win!
                            </h3>
                            <p className="text-sm text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                You are about to set the status to <span className="font-bold text-emerald-600">Won</span>.
                            </p>
                        </div>

                        {wonConfirmationId && (
                            <div className="bg-slate-50 rounded-xl p-4 w-full border border-slate-100 mt-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                    Confirmed Fringe Rate
                                </p>
                                <p className="text-xl font-black text-[#0F4C75]">
                                    {estimates.find(e => e._id === wonConfirmationId)?.fringe || 'None'}
                                </p>
                            </div>
                        )}

                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                            <span className="mr-1">⚠️</span> This will lock the Fringe Rate
                        </p>
                    </div>
                </Modal>
        </div>
    );
}
