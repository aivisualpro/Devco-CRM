'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, 
    MoreVertical, Pencil, Trash2, Calendar, FileText, 
    Receipt, DollarSign, CheckCircle, XCircle, Tag,
    Link, Upload, Loader2, ChevronDown, Check, User
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { 
    Header, Button, Table, TableHeader, TableRow, TableHead, 
    TableBody, TableCell, Badge, Input, Modal, 
    MyDropDown, Tooltip, TooltipTrigger, TooltipContent
} from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { ReceiptModal, ReceiptData } from '@/components/dialogs/ReceiptModal';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS, DATA_SCOPE } from '@/lib/permissions/types';

interface Estimate {
    _id: string;
    estimate?: string;
    versionNumber?: number;
    projectName?: string;
    receiptsAndCosts?: ReceiptItem[];
    [key: string]: any;
}

interface ReceiptItem {
    _id?: string; // Client-side generated if new
    type: 'Invoice' | 'Receipt';
    vendor: string;
    amount: number | string;
    date: string;
    dueDate?: string;
    remarks?: string;
    tag?: string[];
    approvalStatus?: 'Approved' | 'Not Approved';
    status?: 'Devco Paid' | '';
    paidBy?: string;
    paymentDate?: string;
    upload?: any[];
    createdBy?: string;
    // Helper fields for this view
    estimateId?: string;
    estimateNumber?: string;
    projectName?: string;
}

// Flattened receipt for display
interface FlatReceipt extends ReceiptItem {
    uniqueId: string; // Composite ID for list key
    estimateId: string;
    estimateNumber: string;
    projectName: string;
}

export default function ReceiptsCostsPage() {
    const router = useRouter();
    const { user, can, getDataScope } = usePermissions();
    const canApprove = can(MODULES.RECEIPTS_COSTS, ACTIONS.APPROVE);
    const canCreate = can(MODULES.RECEIPTS_COSTS, ACTIONS.CREATE);
    const canEdit = can(MODULES.RECEIPTS_COSTS, ACTIONS.EDIT);
    const canDelete = can(MODULES.RECEIPTS_COSTS, ACTIONS.DELETE);
    const [loading, setLoading] = useState(true);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editingReceipt, setEditingReceipt] = useState<FlatReceipt | null>(null);
    const [receiptToDelete, setReceiptToDelete] = useState<FlatReceipt | null>(null);
    const [saving, setSaving] = useState(false);

    const [employees, setEmployees] = useState<any[]>([]); // For ReceiptModal tags
    
    // Filter Tabs
    const [approvalFilter, setApprovalFilter] = useState<'All' | 'Approved' | 'Not Approved'>('All');
    const [paymentFilter, setPaymentFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');

    // Estimate Selection
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    const [estimateSearch, setEstimateSearch] = useState('');
    const [isEstimateDropdownOpen, setIsEstimateDropdownOpen] = useState(false);

    // Mobile action sheet
    const [actionSheetItem, setActionSheetItem] = useState<FlatReceipt | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleLongPressStart = (receipt: FlatReceipt) => {
        longPressTimer.current = setTimeout(() => {
            setActionSheetItem(receipt);
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const [tagInput, setTagInput] = useState('');

    const fetchEstimates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                action: 'getEstimates',
                payload: { limit: 1000, includeReceipts: true }
            })
            });
            const data = await res.json();
            if (data.success) {
                setEstimates(data.result || []);
            } else {
                toast.error('Failed to fetch estimates');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEstimates();
        
        // Fetch employees
        fetch('/api/webhook/devcoBackend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getEmployees' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) setEmployees(data.result || []);
        })
        .catch(console.error);
    }, []);

    // Derived State: Flattened Receipts
    const allReceipts = useMemo(() => {
        const flat: FlatReceipt[] = [];
        const scope = getDataScope(MODULES.RECEIPTS_COSTS);
        const userEmail = user?.email?.toLowerCase();
        const userId = user?.userId;

        estimates.forEach(est => {
            if (est.receiptsAndCosts && Array.isArray(est.receiptsAndCosts)) {
                est.receiptsAndCosts.forEach((r, idx) => {
                    // Row-level security: if scope is SELF, only show creator and tagged users
                    if (scope === DATA_SCOPE.SELF && !user?.role?.includes('Admin')) {
                        const isCreator = r.createdBy?.toLowerCase() === userEmail;
                        const isTagged = (r.tag || []).some(t => {
                            const tl = t.toLowerCase();
                            return tl === userEmail || t === userId;
                        });

                        if (!isCreator && !isTagged) return;
                    }

                    flat.push({
                        ...r,
                        uniqueId: `${est._id}_${idx}`, // Stable-ish key
                        estimateId: est._id,
                        estimateNumber: est.estimate || 'N/A',
                        projectName: est.projectName || 'Untitled Project'
                    });
                });
            }
        });
        return flat;
    }, [estimates, user, getDataScope]);

    // Filtering & Sorting
    const filteredReceipts = useMemo(() => {
        let result = [...allReceipts];

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(r => 
                String(r.vendor || '').toLowerCase().includes(s) ||
                String(r.remarks || '').toLowerCase().includes(s) ||
                String(r.estimateNumber || '').toLowerCase().includes(s) ||
                String(r.projectName || '').toLowerCase().includes(s) ||
                String(r.amount || '').includes(s)
            );
        }

        // Approval filter
        if (approvalFilter !== 'All') {
            result = result.filter(r => {
                if (approvalFilter === 'Approved') return r.approvalStatus === 'Approved';
                return r.approvalStatus !== 'Approved'; // 'Not Approved' or undefined/Pending
            });
        }

        // Payment filter
        if (paymentFilter !== 'All') {
            result = result.filter(r => {
                if (paymentFilter === 'Paid') return !!r.status; // 'Devco Paid' or any truthy
                return !r.status; // empty string or undefined
            });
        }

        result.sort((a: any, b: any) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [allReceipts, search, sortConfig, approvalFilter, paymentFilter]);

    // Counts for filter badges
    const approvalCounts = useMemo(() => {
        const approved = allReceipts.filter(r => r.approvalStatus === 'Approved').length;
        return { all: allReceipts.length, approved, notApproved: allReceipts.length - approved };
    }, [allReceipts]);

    const paymentCounts = useMemo(() => {
        const paid = allReceipts.filter(r => !!r.status).length;
        return { all: allReceipts.length, paid, unpaid: allReceipts.length - paid };
    }, [allReceipts]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleEdit = (receipt: FlatReceipt) => {
        setEditingReceipt(receipt);
        setSelectedEstimateId(receipt.estimateId);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingReceipt(null);
        setSelectedEstimateId('');
        setIsModalOpen(true);
    };

    const handleSave = async (data: ReceiptData) => {
        if (!selectedEstimateId) {
            toast.error('Please select an estimate');
            return;
        }

        setSaving(true);
        try {
            const targetEstimate = estimates.find(e => e._id === selectedEstimateId);
            if (!targetEstimate) throw new Error('Target estimate not found');

            let updatedReceipts = [...(targetEstimate.receiptsAndCosts || [])];

            const newReceiptItem: ReceiptItem = {
                type: data.type,
                vendor: data.vendor,
                amount: parseFloat(data.amount) || 0,
                date: data.date,
                dueDate: data.dueDate,
                remarks: data.remarks,
                tag: data.tag,
                approvalStatus: data.approvalStatus,
                status: data.status,
                paidBy: data.paidBy,
                paymentDate: data.paymentDate,
                upload: data.upload,
                createdBy: editingReceipt ? data.createdBy : user?.email
            };

            if (editingReceipt) {
                // If estimate ID changed:
                if (editingReceipt.estimateId !== selectedEstimateId) {
                    // Remove from old
                    const oldEst = estimates.find(e => e._id === editingReceipt.estimateId);
                    if (oldEst) {
                        const oldReceipts = (oldEst.receiptsAndCosts || []).filter(r => 
                            // Try to match by object reference or properties if no ID
                            JSON.stringify(r) !== JSON.stringify(editingReceipt) // This is weak, but receipts don't always have IDs
                        );
                        // Save old estimate
                         await fetch('/api/webhook/devcoBackend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                action: 'updateEstimate', 
                                payload: { id: oldEst._id, receiptsAndCosts: oldReceipts } 
                            })
                        });
                    }
                    // Add to new (bottom)
                    updatedReceipts.push(newReceiptItem);
                } else {
                    // Update in place
                    const index = parseInt(editingReceipt.uniqueId.split('_')[1]);
                    if (!isNaN(index) && index >= 0 && index < updatedReceipts.length) {
                        updatedReceipts[index] = newReceiptItem;
                    } else {
                        updatedReceipts.push(newReceiptItem);
                    }
                }
            } else {
                updatedReceipts.push(newReceiptItem);
            }

            // Save to Backend
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateEstimate', 
                    payload: { 
                        id: selectedEstimateId, 
                        receiptsAndCosts: updatedReceipts,
                        updatedBy: user?.email
                    } 
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingReceipt ? 'Receipt updated' : 'Receipt added');
                setIsModalOpen(false);
                fetchEstimates(); // Refresh all data
            } else {
                toast.error('Failed to save receipt');
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!receiptToDelete) return;
        setSaving(true);
        try {
            const targetEstimate = estimates.find(e => e._id === receiptToDelete.estimateId);
            if (!targetEstimate) return;

            const index = parseInt(receiptToDelete.uniqueId.split('_')[1]);
            const updatedReceipts = [...(targetEstimate.receiptsAndCosts || [])];
            
            if (!isNaN(index)) {
                updatedReceipts.splice(index, 1);
            }

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateEstimate', 
                    payload: { 
                        id: receiptToDelete.estimateId, 
                        receiptsAndCosts: updatedReceipts,
                        updatedBy: user?.email
                    } 
                })
            });

            if (res.ok) {
                toast.success('Receipt deleted');
                setIsDeleteOpen(false);
                fetchEstimates();
            } else {
                toast.error('Failed to delete');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting receipt');
        } finally {
            setSaving(false);
        }
    };



    // Filter estimates for dropdown - Deduplicated by Estimate Number
    const filteredEstimates = useMemo(() => {
        // Group by estimate number and keep only the latest version
        const uniqueEstimatesMap: Record<string, Estimate> = {};
        
        estimates.forEach(est => {
            const num = est.estimate;
            if (!num) return;
            
            // If new or higher version, update
            if (!uniqueEstimatesMap[num] || (est.versionNumber || 0) > (uniqueEstimatesMap[num].versionNumber || 0)) {
                uniqueEstimatesMap[num] = est;
            }
        });

        let res = Object.values(uniqueEstimatesMap);

        if (estimateSearch) {
            res = res.filter(e => 
                (e.estimate || '').toLowerCase().includes(estimateSearch.toLowerCase()) ||
                (e.projectName || '').toLowerCase().includes(estimateSearch.toLowerCase())
            );
        }
        // Sort by Estimate Number (desc)
        return res.sort((a, b) => {
            return (b.estimate || '').localeCompare(a.estimate || '');
        }).slice(0, 50);
    }, [estimates, estimateSearch]);

    const getSelectedEstimateLabel = () => {
        const est = estimates.find(e => e._id === selectedEstimateId);
        return est ? `${est.estimate || 'No #'} - ${est.projectName || 'Untitled'}` : 'Select Estimate...';
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header 
                rightContent={
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="relative flex-1 max-w-[200px] sm:max-w-[264px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                placeholder="Search receipts..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        {canCreate && (
                            <div className="hidden lg:block">
                                <Button 
                                    onClick={handleAddNew}
                                    className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white w-8 h-8 p-0 rounded-full flex items-center justify-center"
                                >
                                    <Plus size={16} />
                                </Button>
                            </div>
                        )}
                    </div>
                }
            />

            <div className="flex-1 p-4 lg:p-6 overflow-auto flex flex-col min-h-0">
                {/* Filter Tabs */}
                {!loading && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                        {/* By Approval */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Approval</span>
                            {(['All', 'Approved', 'Not Approved'] as const).map((tab) => {
                                const count = tab === 'All' ? approvalCounts.all : tab === 'Approved' ? approvalCounts.approved : approvalCounts.notApproved;
                                const isActive = approvalFilter === tab;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setApprovalFilter(tab)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5',
                                            isActive
                                                ? tab === 'Approved'
                                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                                                    : tab === 'Not Approved'
                                                        ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                                                        : 'bg-[#0F4C75] text-white shadow-sm shadow-blue-200'
                                                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        )}
                                    >
                                        {tab}
                                        <span className={cn(
                                            'text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center',
                                            isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="hidden sm:block w-px h-6 bg-slate-200" />

                        {/* By Payment */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Payment</span>
                            {(['All', 'Paid', 'Unpaid'] as const).map((tab) => {
                                const count = tab === 'All' ? paymentCounts.all : tab === 'Paid' ? paymentCounts.paid : paymentCounts.unpaid;
                                const isActive = paymentFilter === tab;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setPaymentFilter(tab)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5',
                                            isActive
                                                ? tab === 'Paid'
                                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                                                    : tab === 'Unpaid'
                                                        ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                                                        : 'bg-[#0F4C75] text-white shadow-sm shadow-blue-200'
                                                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        )}
                                    >
                                        {tab}
                                        <span className={cn(
                                            'text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center',
                                            isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#0F4C75]" />
                            <span className="text-sm text-slate-500">Loading receipts...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {filteredReceipts.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No receipts found.</p>
                                </div>
                            ) : (
                                filteredReceipts.map((receipt) => {
                                    const creator = employees.find(e => e.email === receipt.createdBy || e._id === receipt.createdBy);
                                    const amtFormatted = receipt.amount ? `$${(typeof receipt.amount === 'number' ? receipt.amount : parseFloat(String(receipt.amount))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                                    return (
                                        <div
                                            key={receipt.uniqueId}
                                            className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.98] transition-transform shadow-sm"
                                            onClick={() => handleEdit(receipt)}
                                            onTouchStart={() => handleLongPressStart(receipt)}
                                            onTouchEnd={handleLongPressEnd}
                                            onTouchCancel={handleLongPressEnd}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{receipt.vendor || '-'}</div>
                                                    <span className="text-xs text-slate-500 truncate block max-w-[180px]">{receipt.projectName || '-'}</span>
                                                </div>
                                                <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] shrink-0">
                                                    {receipt.estimateNumber || 'N/A'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
                                                <div className="text-xs text-slate-500">
                                                    {receipt.date && !isNaN(new Date(receipt.date).getTime()) ? format(new Date(receipt.date), 'MMM dd, yyyy') : '-'}
                                                </div>
                                                <span className="font-mono text-sm font-bold text-slate-800">{amtFormatted}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    {creator?.image || creator?.profilePicture ? (
                                                        <img src={creator.image || creator.profilePicture} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                                            <User className="w-2.5 h-2.5 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-slate-500">{creator?.label || creator?.firstName || receipt.createdBy || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {receipt.approvalStatus === 'Approved' && (
                                                        <Badge variant="success" className="text-[9px] px-1.5 py-0">Approved</Badge>
                                                    )}
                                                    {receipt.status && (
                                                        <span className="text-[9px] text-green-600 flex items-center gap-0.5">
                                                            <CheckCircle size={9} /> Paid
                                                        </span>
                                                    )}
                                                    {receipt.upload && receipt.upload.length > 0 && (
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                            <FileText size={10} />
                                                            <span>{receipt.upload.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:flex flex-col flex-1 min-h-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden">
                    <Table containerClassName="flex-1 overflow-auto">
                        <TableHead>
                            <TableRow>
                                <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                                    <div className="flex items-center gap-1">Date <ArrowUpDown size={12} className="opacity-50" /></div>
                                </TableHeader>
                                <TableHeader className="w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('estimateNumber')}>
                                    <div className="flex items-center gap-1">Estimate <ArrowUpDown size={12} className="opacity-50" /></div>
                                </TableHeader>
                                <TableHeader className="min-w-[150px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('projectName')}>
                                    <div className="flex items-center gap-1">Project <ArrowUpDown size={12} className="opacity-50" /></div>
                                </TableHeader>
                                <TableHeader className="min-w-[150px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('vendor')}>
                                    <div className="flex items-center gap-1">Vendor <ArrowUpDown size={12} className="opacity-50" /></div>
                                </TableHeader>
                                <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('amount')}>
                                    <div className="flex items-center gap-1">Amount <ArrowUpDown size={12} className="opacity-50" /></div>
                                </TableHeader>
                                <TableHeader className="min-w-[150px]">Remarks</TableHeader>
                                <TableHeader className="w-[120px]">Created By</TableHeader>
                                <TableHeader className="w-[120px]">Tagged To</TableHeader>
                                {canApprove && (
                                    <TableHeader className="w-[100px]">Approval</TableHeader>
                                )}
                                <TableHeader className="w-[100px]">Payment</TableHeader>
                                <TableHeader className="w-[60px] text-center">Docs</TableHeader>
                                <TableHeader className="w-[80px] text-right">Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredReceipts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-48 text-center text-slate-500">
                                        No receipts found.
                                    </TableCell>
                                </TableRow>
                            ) : filteredReceipts.map((receipt) => {
                                const creator = employees.find(e => e.email === receipt.createdBy || e._id === receipt.createdBy);
                                return (
                                <TableRow key={receipt.uniqueId} className="group hover:bg-slate-50 transition-colors">
                                    <TableCell className="font-medium text-slate-700 text-xs whitespace-nowrap">
                                        {receipt.date && !isNaN(new Date(receipt.date).getTime()) ? format(new Date(receipt.date), 'MMM dd, yyyy') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <span 
                                            className="font-semibold text-[#0F4C75] text-xs cursor-pointer hover:underline"
                                            onClick={() => router.push(`/estimates/${receipt.estimateNumber}`)}
                                        >
                                            {receipt.estimateNumber || 'N/A'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 max-w-[150px] truncate" title={receipt.projectName}>
                                        {receipt.projectName || '-'}
                                    </TableCell>
                                    <TableCell className="font-medium text-xs text-slate-700 max-w-[150px] truncate" title={receipt.vendor}>{receipt.vendor}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-700">
                                        {receipt.amount ? `$${(typeof receipt.amount === 'number' ? receipt.amount : parseFloat(receipt.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500 max-w-[200px] truncate" title={receipt.remarks}>
                                        {receipt.remarks || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    {creator?.image || creator?.profilePicture ? (
                                                        <img src={creator.image || creator.profilePicture} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                                            <User className="w-3 h-3 text-slate-400" />
                                                        </div>
                                                    )}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{creator?.label || creator?.firstName ? `${creator.firstName} ${creator.lastName || ''}` : (receipt.createdBy || 'Unknown User')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                            <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{creator?.label || creator?.firstName || receipt.createdBy || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex -space-x-2 overflow-hidden items-center">
                                            {(receipt.tag || []).map((tagId, i) => {
                                                const emp = employees.find(e => e.email === tagId || e._id === tagId);
                                                const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : tagId;
                                                return (
                                                    <Tooltip key={i}>
                                                        <TooltipTrigger>
                                                            <div className="relative inline-block w-6 h-6 rounded-full border border-white bg-slate-100 flex items-center justify-center overflow-hidden cursor-help">
                                                                {emp?.image || emp?.profilePicture ? (
                                                                    <img src={emp.image || emp.profilePicture} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-slate-500">{(emp?.firstName?.[0] || tagId?.[0] || '?').toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{name || 'Unknown User'}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                            {(!receipt.tag || receipt.tag.length === 0) && <span className="text-slate-300 text-xs">-</span>}
                                        </div>
                                    </TableCell>
                                    {canApprove && (
                                        <TableCell>
                                            <Badge variant={receipt.approvalStatus === 'Approved' ? 'success' : 'default'} className="w-fit text-[10px]">
                                                {receipt.approvalStatus || 'Pending'}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        {receipt.status ? (
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1 whitespace-nowrap">
                                                <CheckCircle size={10} className="text-green-500" /> {receipt.status}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {(!receipt.upload || receipt.upload.length === 0) ? (
                                            <span className="text-slate-300 text-xs">-</span>
                                        ) : receipt.upload.length === 1 ? (
                                            <a 
                                                href={typeof receipt.upload[0] === 'string' ? receipt.upload[0] : receipt.upload[0].url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                title={typeof receipt.upload[0] === 'string' ? 'Document' : receipt.upload[0].name}
                                            >
                                                <FileText size={16} />
                                            </a>
                                        ) : (
                                            <Popover>
                                                <PopoverTrigger>
                                                     <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100 transition-colors">
                                                        <FileText size={16} />
                                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
                                                            {receipt.upload.length}
                                                        </span>
                                                     </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-2">
                                                    <div className="flex flex-col gap-1">
                                                        {receipt.upload.map((file, i) => {
                                                            const url = typeof file === 'string' ? file : file.url;
                                                            const name = typeof file === 'string' ? `Document ${i + 1}` : file.name;
                                                            return (
                                                                <a 
                                                                    key={i} 
                                                                    href={url} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="text-xs p-2 hover:bg-slate-50 rounded flex items-center gap-2 text-blue-600 break-all"
                                                                >
                                                                    <Link size={12} className="shrink-0" /> 
                                                                    <span className="line-clamp-2">{name}</span>
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canEdit && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(receipt)}>
                                                    <Pencil size={14} />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => { setReceiptToDelete(receipt); setIsDeleteOpen(true); }}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            {canCreate && (
                <button
                    onClick={handleAddNew}
                    className="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform z-30 border-4 border-white"
                >
                    <Plus size={24} />
                </button>
            )}

            {/* Mobile Action Sheet */}
            {actionSheetItem && (
                <div
                    className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-20 lg:pb-4 transition-all"
                    onClick={() => setActionSheetItem(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-slate-100">
                            <p className="text-sm font-bold text-slate-800">
                                {actionSheetItem.vendor || 'Receipt'} — {actionSheetItem.estimateNumber || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500">{actionSheetItem.projectName}</p>
                        </div>
                        <div className="p-2">
                            {canEdit && (
                                <button
                                    onClick={() => { handleEdit(actionSheetItem); setActionSheetItem(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50"
                                >
                                    <Pencil size={18} /> Edit
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => { setReceiptToDelete(actionSheetItem); setIsDeleteOpen(true); setActionSheetItem(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 size={18} /> Delete
                                </button>
                            )}
                        </div>
                        <div className="p-2 border-t border-slate-100">
                            <button
                                onClick={() => setActionSheetItem(null)}
                                className="w-full py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            <ReceiptModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingReceipt ? (editingReceipt as unknown as ReceiptData) : null}
                onSave={handleSave}
                employees={employees}
                currentUserEmail={user?.email || undefined}
                canApprove={canApprove}
            >
                {/* Estimate Selection (Critical) */}
                <div className="col-span-1 md:col-span-2 mb-4">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Linked Estimate *</Label>
                    <div className="relative mt-1">
                        <div 
                            className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                            onClick={() => setIsEstimateDropdownOpen(!isEstimateDropdownOpen)}
                        >
                            <span className={`text-sm ${selectedEstimateId ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                {getSelectedEstimateLabel()}
                            </span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </div>
                        
                        {isEstimateDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-50 max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-2 border-b bg-slate-50">
                                    <Input 
                                        placeholder="Search estimates..." 
                                        autoFocus
                                        value={estimateSearch}
                                        onChange={(e) => setEstimateSearch(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="overflow-y-auto flex-1 p-1">
                                    {filteredEstimates.map(est => (
                                        <div 
                                            key={est._id}
                                            className={cn(
                                                "px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between",
                                                selectedEstimateId === est._id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
                                            )}
                                            onClick={() => {
                                                setSelectedEstimateId(est._id);
                                                setIsEstimateDropdownOpen(false);
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold flex items-center gap-2">
                                                    {est.estimate || 'No #'} 
                                                </span>
                                                <span className="text-xs opacity-70">{est.projectName}</span>
                                            </div>
                                            {selectedEstimateId === est._id && <Check size={14} />}
                                        </div>
                                    ))}
                                    {filteredEstimates.length === 0 && (
                                        <div className="p-3 text-center text-xs text-slate-400">No estimates found</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Overlay to close dropdown */}
                     {isEstimateDropdownOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsEstimateDropdownOpen(false)} />
                    )}
                </div>
            </ReceiptModal>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Receipt</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this receipt for <strong>{receiptToDelete?.vendor}</strong> (${receiptToDelete?.amount})?
                            <br/>This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
