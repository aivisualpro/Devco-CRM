'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, 
    MoreVertical, Pencil, Trash2, Calendar, FileText, 
    Link, Upload, Loader2, ChevronDown, Check, User, DollarSign, Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { 
    Header, Button, Table, TableHeader, TableRow, TableHead, 
    TableBody, TableCell, Badge, Input, Tooltip, TooltipTrigger, TooltipContent
} from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { BillingTicketModal, BillingTicketData } from '@/components/dialogs/BillingTicketModal';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

interface BillingTicketItem {
    _id?: string;
    estimate?: string;
    date: string;
    billingTerms: string;
    otherBillingTerms?: string;
    uploads?: any[];
    titleDescriptions?: { title: string; description: string }[];
    lumpSum: string;
    createdBy?: string;
    createdAt?: string;
    [key: string]: any;
}

interface Estimate {
    _id: string;
    estimate?: string;
    versionNumber?: number;
    projectName?: string;
    billingTickets?: BillingTicketItem[];
    [key: string]: any;
}

interface FlatBillingTicket extends BillingTicketItem {
    uniqueId: string;
    estimateId: string;
    estimateNumber: string;
    projectName: string;
}

export default function BillingTicketsPage() {
    const router = useRouter();
    const { user, can } = usePermissions();
    const canApprove = can(MODULES.BILLING_TICKETS, ACTIONS.APPROVE);
    const canCreate = can(MODULES.BILLING_TICKETS, ACTIONS.CREATE);
    const canEdit = can(MODULES.BILLING_TICKETS, ACTIONS.EDIT);
    const canDelete = can(MODULES.BILLING_TICKETS, ACTIONS.DELETE);
    const [loading, setLoading] = useState(true);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<FlatBillingTicket | null>(null);
    const [ticketToDelete, setTicketToDelete] = useState<FlatBillingTicket | null>(null);
    const [saving, setSaving] = useState(false);

    const [employees, setEmployees] = useState<any[]>([]); 
    
    // Estimate Selection
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    const [estimateSearch, setEstimateSearch] = useState('');
    const [isEstimateDropdownOpen, setIsEstimateDropdownOpen] = useState(false);

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

    // Derived State: Flattened Tickets
    const allTickets = useMemo(() => {
        const flat: FlatBillingTicket[] = [];
        estimates.forEach(est => {
            if (est.billingTickets && Array.isArray(est.billingTickets)) {
                est.billingTickets.forEach((ticket, idx) => {
                    flat.push({
                        ...ticket,
                        uniqueId: ticket._id || `${est._id}_${idx}`, 
                        estimateId: est._id,
                        estimateNumber: est.estimate || 'N/A',
                        projectName: est.projectName || 'Untitled Project'
                    });
                });
            }
        });
        return flat;
    }, [estimates]);

    // Filtering & Sorting
    const filteredTickets = useMemo(() => {
        let result = [...allTickets];

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(r => 
                String(r.estimateNumber || '').toLowerCase().includes(s) ||
                String(r.projectName || '').toLowerCase().includes(s) ||
                String(r.lumpSum || '').includes(s) ||
                (r.titleDescriptions && r.titleDescriptions.some(td => td.title.toLowerCase().includes(s)))
            );
        }

        result.sort((a: any, b: any) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [allTickets, search, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleEdit = (ticket: FlatBillingTicket) => {
        setEditingTicket(ticket);
        setSelectedEstimateId(ticket.estimateId);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingTicket(null);
        setSelectedEstimateId('');
        setIsModalOpen(true);
    };

    const handleSave = async (data: BillingTicketData) => {
        if (!selectedEstimateId) {
            toast.error('Please select an estimate');
            return;
        }

        setSaving(true);
        try {
            const targetEstimate = estimates.find(e => e._id === selectedEstimateId);
            if (!targetEstimate) throw new Error('Target estimate not found');

            let updatedTickets = [...(targetEstimate.billingTickets || [])];

            const newTicketItem: BillingTicketItem = {
                _id: editingTicket?._id, // Preserve ID if editing
                date: data.date,
                billingTerms: data.billingTerms,
                otherBillingTerms: data.otherBillingTerms,
                lumpSum: data.lumpSum,
                titleDescriptions: data.titleDescriptions,
                uploads: data.uploads,
                createdBy: editingTicket ? data.createdBy : user?.email,
                createdAt: editingTicket ? editingTicket.createdAt : new Date().toISOString()
            };

            if (editingTicket) {
                // If estimate ID changed:
                if (editingTicket.estimateId !== selectedEstimateId) {
                    // Remove from old
                    const oldEst = estimates.find(e => e._id === editingTicket.estimateId);
                    if (oldEst) {
                        const oldTickets = (oldEst.billingTickets || []).filter(r => 
                            (r._id && r._id !== editingTicket._id) || 
                            (!r._id && JSON.stringify(r) !== JSON.stringify(editingTicket)) // fallback
                        );
                        // Save old estimate
                         await fetch('/api/webhook/devcoBackend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                action: 'updateEstimate', 
                                payload: { id: oldEst._id, billingTickets: oldTickets } 
                            })
                        });
                    }
                    // Add to new (bottom)
                    updatedTickets.push(newTicketItem);
                } else {
                    // Update in place
                    const index = updatedTickets.findIndex(t => 
                        (t._id && t._id === editingTicket._id) || 
                        (!t._id && JSON.stringify(t) === JSON.stringify(editingTicket)) // Loose match fallback
                    );
                    
                    if (index >= 0) {
                        updatedTickets[index] = { ...updatedTickets[index], ...newTicketItem };
                    } else {
                        // Use uniqueId fallback check
                        const legacyIndex = parseInt(editingTicket.uniqueId.split('_')[1]);
                        if (!isNaN(legacyIndex) && legacyIndex >= 0 && legacyIndex < updatedTickets.length) {
                             updatedTickets[legacyIndex] = newTicketItem;
                        } else {
                             updatedTickets.push(newTicketItem);
                        }
                    }
                }
            } else {
                updatedTickets.push(newTicketItem);
            }

            // Save to Backend
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateEstimate', 
                    payload: { 
                        id: selectedEstimateId, 
                        billingTickets: updatedTickets,
                        updatedBy: user?.email
                    } 
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingTicket ? 'Billing Ticket updated' : 'Billing Ticket added');
                setIsModalOpen(false);
                fetchEstimates(); 
            } else {
                toast.error('Failed to save ticket');
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!ticketToDelete) return;
        setSaving(true);
        try {
            const targetEstimate = estimates.find(e => e._id === ticketToDelete.estimateId);
            if (!targetEstimate) return;

            let updatedTickets = [...(targetEstimate.billingTickets || [])];
           
            // Logic to find and remove
            const index = updatedTickets.findIndex(t => 
                (t._id && t._id === ticketToDelete._id) || 
                (ticketToDelete.uniqueId && ticketToDelete.uniqueId.includes('_') && 
                 parseInt(ticketToDelete.uniqueId.split('_')[1]) < updatedTickets.length && 
                 JSON.stringify(updatedTickets[parseInt(ticketToDelete.uniqueId.split('_')[1])]) === JSON.stringify(ticketToDelete)) // messy fallback for legacy
            );

            // Simple index fallback
            if (index === -1) {
                 const simpleIndex = parseInt(ticketToDelete.uniqueId.split('_')[1]);
                 if (!isNaN(simpleIndex)) updatedTickets.splice(simpleIndex, 1);
            } else {
                updatedTickets.splice(index, 1);
            }

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateEstimate', 
                    payload: { 
                        id: ticketToDelete.estimateId, 
                        billingTickets: updatedTickets,
                        updatedBy: user?.email
                    } 
                })
            });

            if (res.ok) {
                toast.success('Ticket deleted');
                setIsDeleteOpen(false);
                fetchEstimates();
            } else {
                toast.error('Failed to delete');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting ticket');
        } finally {
            setSaving(false);
        }
    };

    // Filter estimates for dropdown - Deduplicated by Estimate Number
    const filteredEstimates = useMemo(() => {
        const uniqueEstimatesMap: Record<string, Estimate> = {};
        
        estimates.forEach(est => {
            const num = est.estimate;
            if (!num) return;
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
                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                placeholder="Search tickets..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        {canCreate && (
                            <Button 
                                onClick={handleAddNew}
                                className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white w-8 h-8 p-0 rounded-full flex items-center justify-center"
                            >
                                <Plus size={16} />
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
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
                                <TableHeader className="w-[120px]">Term</TableHeader>
                                <TableHeader className="min-w-[150px]">Lump Sum</TableHeader>
                                <TableHeader className="min-w-[150px]">Title</TableHeader>
                                <TableHeader className="w-[120px]">Created By</TableHeader>
                                <TableHeader className="w-[60px] text-center">Docs</TableHeader>
                                <TableHeader className="w-[80px] text-right">Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="animate-spin text-[#0F4C75]" />
                                            Loading tickets...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredTickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center text-slate-500">
                                        No billing tickets found.
                                    </TableCell>
                                </TableRow>
                            ) : filteredTickets.map((ticket) => {
                                const creator = employees.find(e => e.email === ticket.createdBy || e._id === ticket.createdBy);
                                return (
                                <TableRow key={ticket.uniqueId} className="group hover:bg-slate-50 transition-colors">
                                    <TableCell className="font-medium text-slate-700 text-xs whitespace-nowrap">
                                        {ticket.date && !isNaN(new Date(ticket.date).getTime()) ? format(new Date(ticket.date), 'MMM dd, yyyy') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <span 
                                            className="font-semibold text-[#0F4C75] text-xs cursor-pointer hover:underline"
                                            onClick={() => router.push(`/estimates/${ticket.estimateNumber}`)}
                                        >
                                            {ticket.estimateNumber || 'N/A'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 max-w-[150px] truncate" title={ticket.projectName}>
                                        {ticket.projectName || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-700">
                                        {ticket.billingTerms === 'Other' ? ticket.otherBillingTerms : (ticket.billingTerms || '-')}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-700 font-bold">
                                         {ticket.lumpSum ? formatCurrency(ticket.lumpSum) : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">
                                        {(ticket.titleDescriptions && ticket.titleDescriptions.length > 0) ? (
                                            <div className="flex items-center gap-1">
                                                <span className="truncate">{ticket.titleDescriptions[0].title}</span>
                                                {ticket.titleDescriptions.length > 1 && (
                                                    <span className="text-[10px] bg-slate-100 px-1 rounded-full text-slate-500">+{ticket.titleDescriptions.length - 1}</span>
                                                )}
                                            </div>
                                        ) : '-'}
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
                                                    <p>{creator?.label || creator?.firstName ? `${creator.firstName} ${creator.lastName || ''}` : (ticket.createdBy || 'Unknown User')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                            <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{creator?.label || creator?.firstName || ticket.createdBy || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {(!ticket.uploads || ticket.uploads.length === 0) ? (
                                            <span className="text-slate-300 text-xs">-</span>
                                        ) : ticket.uploads.length === 1 ? (
                                            <a 
                                                href={typeof ticket.uploads[0] === 'string' ? ticket.uploads[0] : ticket.uploads[0].url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                            >
                                                <FileText size={16} />
                                            </a>
                                        ) : (
                                            <Popover>
                                                <PopoverTrigger>
                                                     <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100 transition-colors">
                                                        <FileText size={16} />
                                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
                                                            {ticket.uploads.length}
                                                        </span>
                                                     </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-2">
                                                    <div className="flex flex-col gap-1">
                                                        {ticket.uploads.map((file: any, i: number) => {
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
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(ticket)}>
                                                    <Pencil size={14} />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => { setTicketToDelete(ticket); setIsDeleteOpen(true); }}>
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

            {/* Add/Edit Modal */}
            <BillingTicketModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingTicket ? (editingTicket as unknown as BillingTicketData) : null}
                onSave={handleSave}
                employees={employees}
                currentUserEmail={user?.email || undefined}
                canApprove={canApprove}
            >
                {/* Estimate Selection */}
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
                     {isEstimateDropdownOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsEstimateDropdownOpen(false)} />
                    )}
                </div>
            </BillingTicketModal>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Billing Ticket</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this ticket?
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

const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? '-' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};
