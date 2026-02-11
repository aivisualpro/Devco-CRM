'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Search, ArrowUpDown, Pencil, Trash2, 
    Loader2, MapPin, Calendar, FileText, Phone,
    User, CheckCircle, Clock, AlertTriangle, X
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { 
    Header, Button, Table, TableHeader, TableRow, TableHead, 
    TableBody, TableCell, Badge, Input, Modal
} from '@/components/ui';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { usePermissions } from '@/hooks/usePermissions';
import { useAddShortcut } from '@/hooks/useAddShortcut';

interface Ticket {
    _id: string;
    ticketNo: string;
    type: string;
    status: string;
    requestDate: string;
    expirationDate?: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    latitude?: number;
    longitude?: number;
    utilities?: string[];
    remarks?: string;
    estimate?: string;
    projectName?: string;
    callerName?: string;
    contactPhone?: string;
    excavator?: string;
    workDescription?: string;
    responseDate?: string;
    uploads?: any[];
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

const TICKET_TYPES = ['Normal', 'Emergency', 'Routine', 'Meet', 'Remark', 'Update', 'Renewal'];
const TICKET_STATUSES = ['Open', 'Closed', 'Expired', 'In Progress', 'Pending Response'];

export default function Usa811TicketsPage() {
    const { user } = usePermissions();
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'requestDate', direction: 'desc' });

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<Partial<Ticket> | null>(null);
    const [saving, setSaving] = useState(false);

    // Delete
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);

    // Mobile action sheet
    const [actionSheetItem, setActionSheetItem] = useState<Ticket | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleLongPressStart = (ticket: Ticket) => {
        longPressTimer.current = setTimeout(() => {
            setActionSheetItem(ticket);
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    // Utilities input
    const [utilityInput, setUtilityInput] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/usa-811-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getTickets',
                    payload: { search, sortKey: sortConfig.key, sortDir: sortConfig.direction, limit: 500 }
                })
            });
            const data = await res.json();
            if (data.success) {
                setTickets(data.result || []);
                setTotal(data.total || 0);
            } else {
                toast.error('Failed to fetch tickets');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [sortConfig]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTickets();
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleAddNew = () => {
        const today = new Date().toISOString().split('T')[0];
        setEditingTicket({
            ticketNo: '',
            type: 'Normal',
            status: 'Open',
            requestDate: today,
            address: '',
            utilities: [],
        });
        setUtilityInput('');
        setIsModalOpen(true);
    };

    useAddShortcut(handleAddNew);

    const handleEdit = (ticket: Ticket) => {
        setEditingTicket({ ...ticket });
        setUtilityInput('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingTicket?.ticketNo) {
            toast.error('Ticket No is required');
            return;
        }

        setSaving(true);
        try {
            const isEditing = !!(editingTicket as any)?._id;
            const action = isEditing ? 'updateTicket' : 'createTicket';
            const payload = isEditing
                ? { id: (editingTicket as any)._id, ...editingTicket }
                : { ...editingTicket, createdBy: user?.email };

            const res = await fetch('/api/usa-811-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(isEditing ? 'Ticket updated' : 'Ticket created');
                setIsModalOpen(false);
                fetchTickets();
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error saving ticket');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!ticketToDelete) return;
        setSaving(true);
        try {
            const res = await fetch('/api/usa-811-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteTicket', payload: { id: ticketToDelete._id } })
            });
            if (res.ok) {
                toast.success('Ticket deleted');
                setIsDeleteOpen(false);
                setTicketToDelete(null);
                fetchTickets();
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Open': return 'bg-green-100 text-green-700 border-green-200';
            case 'Closed': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'Expired': return 'bg-red-100 text-red-700 border-red-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Pending Response': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Emergency': return 'bg-red-100 text-red-700 border-red-200';
            case 'Normal': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Routine': return 'bg-teal-100 text-teal-700 border-teal-200';
            case 'Meet': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Renewal': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const formatDate = (d?: string) => {
        if (!d) return '-';
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? '-' : format(dt, 'MMM dd, yyyy');
    };

    const addUtility = () => {
        const val = utilityInput.trim();
        if (val && editingTicket) {
            const utils = [...(editingTicket.utilities || [])];
            if (!utils.includes(val)) {
                utils.push(val);
                setEditingTicket({ ...editingTicket, utilities: utils });
            }
            setUtilityInput('');
        }
    };

    const removeUtility = (u: string) => {
        if (editingTicket) {
            setEditingTicket({
                ...editingTicket,
                utilities: (editingTicket.utilities || []).filter(x => x !== u)
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header
                rightContent={
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="relative flex-1 max-w-[200px] sm:max-w-[264px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Search tickets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div className="hidden lg:block">
                            <Button
                                onClick={handleAddNew}
                                className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white w-8 h-8 p-0 rounded-full flex items-center justify-center"
                            >
                                <Plus size={16} />
                            </Button>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 p-4 lg:p-6 overflow-auto flex flex-col min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#0F4C75]" />
                            <span className="text-sm text-slate-500">Loading tickets...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {tickets.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No tickets found.</p>
                                </div>
                            ) : (
                                tickets.map((ticket) => (
                                    <div
                                        key={ticket._id}
                                        className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.98] transition-transform shadow-sm"
                                        onClick={() => handleEdit(ticket)}
                                        onTouchStart={() => handleLongPressStart(ticket)}
                                        onTouchEnd={handleLongPressEnd}
                                        onTouchCancel={handleLongPressEnd}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">#{ticket.ticketNo}</div>
                                                <span className="text-xs text-slate-500 truncate block max-w-[200px]">{ticket.address || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getTypeColor(ticket.type)}`}>{ticket.type}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                            <div className="flex items-center gap-1"><Calendar size={11} /> {formatDate(ticket.requestDate)}</div>
                                            {ticket.expirationDate && (
                                                <div className="flex items-center gap-1"><Clock size={11} /> Exp: {formatDate(ticket.expirationDate)}</div>
                                            )}
                                        </div>
                                        {ticket.projectName && (
                                            <div className="mt-2 text-xs text-slate-400 truncate">
                                                {ticket.estimate ? `#${ticket.estimate} — ` : ''}{ticket.projectName}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden lg:flex flex-col flex-1 min-h-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden">
                                <Table containerClassName="flex-1 overflow-auto">
                                    <TableHead>
                                        <TableRow>
                                            <TableHeader className="w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('ticketNo')}>
                                                <div className="flex items-center gap-1">Ticket # <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[90px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('type')}>
                                                <div className="flex items-center gap-1">Type <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                                <div className="flex items-center gap-1">Status <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[110px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('requestDate')}>
                                                <div className="flex items-center gap-1">Request Date <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[110px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('expirationDate')}>
                                                <div className="flex items-center gap-1">Expiration <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="min-w-[180px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('address')}>
                                                <div className="flex items-center gap-1">Address <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[100px]">City</TableHeader>
                                            <TableHeader className="w-[80px]">County</TableHeader>
                                            <TableHeader className="w-[100px]">Estimate</TableHeader>
                                            <TableHeader className="min-w-[140px]">Project</TableHeader>
                                            <TableHeader className="w-[120px]">Excavator</TableHeader>
                                            <TableHeader className="min-w-[120px]">Utilities</TableHeader>
                                            <TableHeader className="w-[80px] text-right">Actions</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {tickets.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={13} className="h-48 text-center text-slate-500">
                                                    No tickets found.
                                                </TableCell>
                                            </TableRow>
                                        ) : tickets.map((ticket) => (
                                            <TableRow key={ticket._id} className="group hover:bg-slate-50 transition-colors">
                                                <TableCell className="font-bold text-xs text-[#0F4C75]">{ticket.ticketNo}</TableCell>
                                                <TableCell>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${getTypeColor(ticket.type)}`}>{ticket.type}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-700 whitespace-nowrap">{formatDate(ticket.requestDate)}</TableCell>
                                                <TableCell className="text-xs text-slate-700 whitespace-nowrap">{formatDate(ticket.expirationDate)}</TableCell>
                                                <TableCell className="text-xs text-slate-600 max-w-[200px] truncate" title={ticket.address}>{ticket.address || '-'}</TableCell>
                                                <TableCell className="text-xs text-slate-600">{ticket.city || '-'}</TableCell>
                                                <TableCell className="text-xs text-slate-600">{ticket.county || '-'}</TableCell>
                                                <TableCell className="text-xs text-[#0F4C75] font-semibold">{ticket.estimate || '-'}</TableCell>
                                                <TableCell className="text-xs text-slate-600 max-w-[140px] truncate" title={ticket.projectName}>{ticket.projectName || '-'}</TableCell>
                                                <TableCell className="text-xs text-slate-600 truncate max-w-[120px]">{ticket.excavator || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(ticket.utilities || []).slice(0, 3).map((u, i) => (
                                                            <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{u}</span>
                                                        ))}
                                                        {(ticket.utilities || []).length > 3 && (
                                                            <span className="text-[9px] text-slate-400">+{(ticket.utilities || []).length - 3}</span>
                                                        )}
                                                        {(!ticket.utilities || ticket.utilities.length === 0) && <span className="text-slate-300 text-xs">-</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(ticket)}>
                                                            <Pencil size={14} />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => { setTicketToDelete(ticket); setIsDeleteOpen(true); }}>
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            <button
                onClick={handleAddNew}
                className="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform z-30 border-4 border-white"
            >
                <Plus size={24} />
            </button>

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
                            <p className="text-sm font-bold text-slate-800">Ticket #{actionSheetItem.ticketNo}</p>
                            <p className="text-xs text-slate-500">{actionSheetItem.address || '-'}</p>
                        </div>
                        <div className="p-2">
                            <button
                                onClick={() => { handleEdit(actionSheetItem); setActionSheetItem(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                                <Pencil size={18} /> Edit
                            </button>
                            <button
                                onClick={() => { setTicketToDelete(actionSheetItem); setIsDeleteOpen(true); setActionSheetItem(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                                <Trash2 size={18} /> Delete
                            </button>
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
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTicket?._id ? 'Edit USA 811 Ticket' : 'New USA 811 Ticket'}
                maxWidth="3xl"
            >
                <div className="space-y-5 py-2">
                    {/* Row 1: Ticket #, Type, Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket No *</Label>
                            <Input
                                value={editingTicket?.ticketNo || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, ticketNo: e.target.value } : null)}
                                placeholder="e.g. 2026021200001"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <SearchableSelect
                                label="Type"
                                placeholder="Select Type"
                                options={TICKET_TYPES}
                                value={editingTicket?.type || ''}
                                onChange={(val) => setEditingTicket(prev => prev ? { ...prev, type: val } : null)}
                                onNext={() => {}}
                                disableBlank={true}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <SearchableSelect
                                label="Status"
                                placeholder="Select Status"
                                options={TICKET_STATUSES}
                                value={editingTicket?.status || ''}
                                onChange={(val) => setEditingTicket(prev => prev ? { ...prev, status: val } : null)}
                                onNext={() => {}}
                                disableBlank={true}
                            />
                        </div>
                    </div>

                    {/* Row 2: Request Date, Expiration Date, Response Date */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request Date</Label>
                            <Input
                                type="date"
                                value={editingTicket?.requestDate ? editingTicket.requestDate.substring(0, 10) : ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, requestDate: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiration Date</Label>
                            <Input
                                type="date"
                                value={editingTicket?.expirationDate ? editingTicket.expirationDate.substring(0, 10) : ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, expirationDate: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Response Date</Label>
                            <Input
                                type="date"
                                value={editingTicket?.responseDate ? editingTicket.responseDate.substring(0, 10) : ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, responseDate: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                    </div>

                    {/* Row 3: Address, City, State, Zip */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</Label>
                            <Input
                                value={editingTicket?.address || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, address: e.target.value } : null)}
                                placeholder="Street address"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">City</Label>
                            <Input
                                value={editingTicket?.city || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, city: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">State</Label>
                            <Input
                                value={editingTicket?.state || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, state: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                    </div>

                    {/* Row 4: Zip, County */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zip</Label>
                            <Input
                                value={editingTicket?.zip || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, zip: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">County</Label>
                            <Input
                                value={editingTicket?.county || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, county: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimate #</Label>
                            <Input
                                value={editingTicket?.estimate || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, estimate: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Name</Label>
                            <Input
                                value={editingTicket?.projectName || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, projectName: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                    </div>

                    {/* Row 5: Caller, Phone, Excavator */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Caller Name</Label>
                            <Input
                                value={editingTicket?.callerName || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, callerName: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Phone</Label>
                            <Input
                                value={editingTicket?.contactPhone || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, contactPhone: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Excavator</Label>
                            <Input
                                value={editingTicket?.excavator || ''}
                                onChange={(e) => setEditingTicket(prev => prev ? { ...prev, excavator: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                    </div>

                    {/* Utilities */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utilities</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                value={utilityInput}
                                onChange={(e) => setUtilityInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUtility(); } }}
                                placeholder="Add utility name"
                                className="h-10 flex-1"
                            />
                            <Button onClick={addUtility} type="button" variant="outline" className="h-10 px-3">
                                <Plus size={14} />
                            </Button>
                        </div>
                        {(editingTicket?.utilities || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {(editingTicket?.utilities || []).map((u, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                        {u}
                                        <button onClick={() => removeUtility(u)} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Work Description */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Description</Label>
                        <textarea
                            value={editingTicket?.workDescription || ''}
                            onChange={(e) => setEditingTicket(prev => prev ? { ...prev, workDescription: e.target.value } : null)}
                            placeholder="Describe the work..."
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-none"
                        />
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remarks</Label>
                        <textarea
                            value={editingTicket?.remarks || ''}
                            onChange={(e) => setEditingTicket(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                            placeholder="Additional notes..."
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white">
                        {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                        {editingTicket?._id ? 'Update' : 'Create'}
                    </Button>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Ticket</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete ticket <strong>#{ticketToDelete?.ticketNo}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
