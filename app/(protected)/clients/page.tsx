'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Pencil, Trash2, FileText, Plus, Building, Building2, Mail, Phone, MapPin, User, Briefcase, Search, ChevronRight, X, MessageSquare } from 'lucide-react';
import { Header, Button, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, Badge, SkeletonTable, BadgeTabs, Modal, ConfirmModal, Input, SearchableSelect } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string;
    active: boolean;
}

interface Client {
    _id: string; // recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string; // This should be an employee ID/email
    contacts: ClientContact[];
    addresses?: string[];
    documents?: any[];
    status?: string;
}

interface Employee {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    email: string;
}

const defaultClient: Partial<Client> = {
    name: '',
    businessAddress: '',
    proposalWriter: '',
    contacts: [],
    addresses: [],
    status: 'Active'
};

const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export default function ClientsPage() {
    const router = useRouter();
    const { success, error } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');
    const [visibleCount, setVisibleCount] = useState(20);
    const itemsPerPage = 20;
    const observerTarget = useRef(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState<Partial<Client>>(defaultClient);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        fetchClients();
        fetchEmployees();
    }, []);

    // Calculate tab counts
    const counts = useMemo(() => {
        return {
            all: clients.length,
            active: clients.filter(c => c.status === 'Active').length,
            inactive: clients.filter(c => c.status !== 'Active').length
        };
    }, [clients]);

    // Filter by Tab then Search
    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            // Tab filter
            if (activeTab === 'active' && c.status !== 'Active') return false;
            if (activeTab === 'inactive' && c.status === 'Active') return false;

            // Search filter
            if (search) {
                const lowerSearch = search.toLowerCase();
                const writer = employees.find(e => e._id === c.proposalWriter || e.email === c.proposalWriter);
                const writerName = writer ? `${writer.firstName} ${writer.lastName}`.toLowerCase() : '';

                const primaryContact = c.contacts?.find(con => con.active) || c.contacts?.[0];
                return (
                    (c.name || '').toLowerCase().includes(lowerSearch) ||
                    (primaryContact?.email || '').toLowerCase().includes(lowerSearch) ||
                    (primaryContact?.name || '').toLowerCase().includes(lowerSearch) ||
                    writerName.includes(lowerSearch)
                );
            }
            return true;
        });
    }, [clients, activeTab, search, employees]);

    const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const mobileClients = filteredClients.slice(0, visibleCount);
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);


    // Reset visible count when search or tab changes
    useEffect(() => {
        setVisibleCount(20);
    }, [search, activeTab]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < filteredClients.length) {
                    setVisibleCount(prev => prev + 20);
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [filteredClients.length, visibleCount]);

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEmployees' })
            });
            const data = await res.json();
            if (data.success) {
                setEmployees(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getClients' })
            });
            const data = await res.json();
            if (data.success) {
                setClients(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching clients:', err);
        }
        setLoading(false);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const rows = text.split('\n');
                const headers = rows[0].split(',').map(h => h.trim());

                const parsedClients = rows.slice(1).filter(r => r.trim()).map(row => {
                    // Simple CSV parsing (associating headers to keys)
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
                    const client: any = {};
                    headers.forEach((h, i) => {
                        const key = h.replace(/^"|"$/g, '');
                        if (key && values[i]) client[key] = values[i];
                    });
                    return client;
                });

                if (parsedClients.length === 0) throw new Error("No valid data found");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importClients', payload: { clients: parsedClients } })
                });

                const data = await res.json();
                if (data.success) {
                    success(`Successfully imported ${parsedClients.length} clients`);
                    fetchClients();
                } else {
                    error('Import failed: ' + data.error);
                }
            } catch (err) {
                error('Error parsing CSV file');
                console.error(err);
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // CRUD Handlers
    const openAddModal = () => {
        setCurrentClient({ ...defaultClient });
        setIsModalOpen(true);
    };

    const openEditModal = (client: Client) => {
        setCurrentClient({ ...client });
        setIsModalOpen(true);
    };

    const openDeleteModal = (client: Client) => {
        setClientToDelete(client);
        setIsDeleteModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentClient.name) {
            error('Client Name is required');
            return;
        }

        try {
            const isEdit = !!currentClient._id;
            const action = isEdit ? 'updateClient' : 'addClient';
            const payload = isEdit
                ? { id: currentClient._id, item: currentClient }
                : { item: currentClient };

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });

            const data = await res.json();
            if (data.success) {
                success(isEdit ? 'Client updated successfully' : 'Client added successfully');
                setIsModalOpen(false);
                fetchClients();
            } else {
                error('Failed to save client: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error saving client:', err);
            error('An error occurred while saving');
        }
    };

    const handleDelete = async () => {
        if (!clientToDelete) return;

        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteClient', payload: { id: clientToDelete._id } })
            });

            const data = await res.json();
            if (data.success) {
                success('Client deleted successfully');
                fetchClients();
            } else {
                error('Failed to delete client');
            }
        } catch (err) {
            console.error('Error deleting client:', err);
            error('An error occurred while deleting');
        }
        setIsDeleteModalOpen(false);
        setClientToDelete(null);
    };

    const tabs = [
        { id: 'all', label: 'All Clients', count: counts.all },
        { id: 'active', label: 'Active', count: counts.active },
        { id: 'inactive', label: 'Inactive', count: counts.inactive }
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
            <Header
                hideLogo={false} // Hidden on mobile via our Header logic, but let's be explicit
                rightContent={
                    <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end md:flex-initial">
                        <SearchInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search clients..."
                        />

                        <input
                            type="file"
                            accept=".csv"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImport}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="hidden lg:flex p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600 disabled:opacity-50"
                            title={isImporting ? 'Importing...' : 'Import CSV'}
                            disabled={isImporting}
                        >
                            <Upload className={`w-4 h-4 ${isImporting ? 'animate-pulse' : ''}`} />
                        </button>

                        <button
                            onClick={openAddModal}
                            className="md:hidden w-10 h-10 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        >
                            <Plus size={24} />
                        </button>
                        <button
                            onClick={openAddModal}
                            className="hidden md:flex p-2.5 bg-[#0F4C75] text-white rounded-full hover:bg-[#0a3a5c] transition-all shadow-lg hover:shadow-[#0F4C75]/30 group"
                            title="New Client"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                }
            />
            </div>
            
            <div className="flex-1 overflow-y-auto pt-4 px-4 pb-0">
                {/* Tabs - Hidden on Mobile */}
                <div className="hidden md:flex justify-center mb-4">
                    <BadgeTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>

                {loading ? (
                    <>
                        <div className="md:hidden grid grid-cols-2 gap-2">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                            ))}
                        </div>
                        <div className="hidden md:block">
                            <SkeletonTable rows={10} columns={7} />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Mobile Card View - 2 Columns */}
                        <div className="md:hidden grid grid-cols-2 gap-2 pb-8">
                            {mobileClients.length === 0 ? (
                                <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-slate-500 font-medium">No clients found</p>
                                </div>
                            ) : (
                                mobileClients.map((client) => {
                                    const writer = employees.find(e => e._id === client.proposalWriter || e.email === client.proposalWriter);
                                    const primaryContact = client.contacts?.find(con => con.active) || client.contacts?.[0];

                                    return (
                                        <div
                                            key={client._id}
                                            className="bg-white rounded-2xl p-3 shadow-sm border border-slate-50 hover:border-slate-100 transition-all active:scale-[0.98] flex flex-col min-h-[140px]"
                                            onClick={() => router.push(`/clients/${client._id}`)}
                                        >
                                            {/* 1st Row: Client Name */}
                                            <div className="mb-1.5">
                                                <h3 className="font-normal text-slate-600 text-xs line-clamp-1 leading-tight">{client.name}</h3>
                                            </div>

                                            {/* 2nd Row: Address */}
                                            <div className="flex items-start gap-1 text-[10px] text-slate-600 mb-1">
                                                <MapPin size={12} className="shrink-0 mt-0.5 text-slate-300" />
                                                <span className="leading-relaxed">{client.businessAddress || 'No address'}</span>
                                            </div>

                                            {/* 3rd Row: Contact Name */}
                                            <div className="flex items-center gap-1 text-[10px] text-slate-600 mb-3 flex-1">
                                                <User size={12} className="shrink-0 text-[#3282B8]" />
                                                <span className="truncate font-normal">{primaryContact?.name || 'No contact'}</span>
                                            </div>

                                            {/* 4th Row: Action Icons & Writer */}
                                            <div className="pt-2.5 border-t border-slate-50 flex items-center justify-between">
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <a href={`tel:${primaryContact?.phone}`} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                                        <Phone size={12} />
                                                    </a>
                                                    <a href={`sms:${primaryContact?.phone}`} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                                        <MessageSquare size={12} />
                                                    </a>
                                                    <a href={`mailto:${primaryContact?.email}`} className="p-1.5 bg-slate-50 text-slate-600 rounded-lg">
                                                        <Mail size={12} />
                                                    </a>
                                                </div>

                                                <div
                                                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-normal text-slate-600 border border-slate-200 overflow-hidden shadow-sm"
                                                    title={writer ? `${writer.firstName} ${writer.lastName}` : 'Unassigned'}
                                                >
                                                    {writer?.profilePicture ? (
                                                        <img src={writer.profilePicture} className="w-full h-full object-cover" />
                                                    ) : (
                                                        writer ? `${writer.firstName?.[0] || ''}${writer.lastName?.[0] || ''}` : '?'
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={observerTarget} className="h-4 col-span-2" />
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                        <Table
                            containerClassName="h-[calc(100vh-140px)] min-h-[400px]"
                            footer={
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            }
                        >
                                <TableHead>
                                    <TableRow>
                                        <TableHeader>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-[#0F4C75]" />
                                                Name
                                            </div>
                                        </TableHeader>
                                        <TableHeader>Address</TableHeader>
                                        <TableHeader>
                                            <div className="flex items-center gap-2">
                                                <Briefcase className="w-4 h-4 text-[#0F4C75]" />
                                                Writer
                                            </div>
                                        </TableHeader>
                                        <TableHeader>Contact</TableHeader>
                                        <TableHeader>Email</TableHeader>
                                        <TableHeader>Phone</TableHeader>
                                        <TableHeader>Status</TableHeader>
                                        <TableHeader className="text-right">Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <p className="text-base font-medium text-gray-900">No clients found</p>
                                                    <p className="text-sm text-gray-500 mt-1">Get started by adding a new client.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedClients.map((client) => {
                                            const writer = employees.find(e => e._id === client.proposalWriter || e.email === client.proposalWriter);
                                            const primaryContact = client.contacts?.find(con => con.active) || client.contacts?.[0];

                                            return (
                                                <TableRow
                                                    key={client._id}
                                                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() => router.push(`/clients/${client._id}`)}
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-[#3282B8]/10 rounded-lg">
                                                                <Building className="w-4 h-4 text-[#0F4C75]" />
                                                            </div>
                                                            <span className="text-slate-600 font-normal">{client.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-start gap-2 max-w-[200px]">
                                                            <MapPin className="w-3.5 h-3.5 text-[#0F4C75] mt-0.5 shrink-0" />
                                                            <span title={client.businessAddress} className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                                                {client.businessAddress || '-'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {writer ? (
                                                            <div 
                                                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-normal text-slate-600 overflow-hidden border border-slate-200 shadow-sm"
                                                                title={`${writer.firstName} ${writer.lastName}`}
                                                            >
                                                                {writer.profilePicture ? (
                                                                    <img src={writer.profilePicture} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    `${writer.firstName?.[0] || ''}${writer.lastName?.[0] || ''}` || '?'
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px] italic">N/A</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs font-normal text-slate-600">{primaryContact?.name || '-'}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {primaryContact?.email ? (
                                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                                <Mail className="w-3.5 h-3.5 text-[#3282B8]" />
                                                                {primaryContact.email}
                                                            </div>
                                                        ) : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {primaryContact?.phone ? (
                                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                                                {primaryContact.phone}
                                                            </div>
                                                        ) : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={client.status === 'Active' ? 'success' : 'default'} className="text-[10px] uppercase font-normal tracking-wider">
                                                            {client.status || 'Active'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => openEditModal(client)}
                                                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openDeleteModal(client)}
                                                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
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
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={currentClient._id ? 'Edit Client' : 'New Client'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Client</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-8">
                    {/* Top Row: Company Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="md:col-span-1">
                            <Input
                                label="Company Name *"
                                value={currentClient.name || ''}
                                onChange={(e) => setCurrentClient({ ...currentClient, name: e.target.value })}
                                placeholder="Enter company name"
                            />
                        </div>

                        <div className="md:col-span-1">
                            <SearchableSelect
                                label="Proposal Writer"
                                value={currentClient.proposalWriter || ''}
                                onChange={(val) => setCurrentClient({ ...currentClient, proposalWriter: val })}
                                options={employees.map(e => ({
                                    label: `${e.firstName} ${e.lastName}`,
                                    value: e._id,
                                    image: e.profilePicture,
                                    initials: `${e.firstName?.[0] || ''}${e.lastName?.[0] || ''}`
                                }))}
                                placeholder="Select writer"
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status</label>
                            <select
                                value={currentClient.status || 'Active'}
                                onChange={(e) => setCurrentClient({ ...currentClient, status: e.target.value })}
                                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#3282B8]/20 focus:border-[#3282B8] transition-all cursor-pointer"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Contacts Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <User className="w-5 h-5 text-[#0F4C75]" />
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Contacts</h4>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    const contacts = [...(currentClient.contacts || [])];
                                    contacts.push({ name: '', email: '', phone: '', type: contacts.length === 0 ? 'Main Contact' : 'Secondary Contact', active: contacts.length === 0 });
                                    setCurrentClient({ ...currentClient, contacts });
                                }}
                                className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider !bg-[#0F4C75]"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1.5" /> ADD CONTACT
                            </Button>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto pr-2 flex flex-col gap-3 thin-scrollbar">
                            {(currentClient.contacts || []).map((contact, idx) => (
                                <div key={idx} className={`p-4 rounded-2xl border transition-all ${contact.active ? 'bg-[#3282B8]/5 border-[#3282B8]/20' : 'bg-slate-50 border-slate-100'} relative group shadow-sm`}>
                                    <button
                                        onClick={() => {
                                            const contacts = currentClient.contacts?.filter((_, i) => i !== idx);
                                            setCurrentClient({ ...currentClient, contacts });
                                        }}
                                        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-3">
                                            <Input
                                                label="Full Name"
                                                value={contact.name}
                                                onChange={(e) => {
                                                    const contacts = [...(currentClient.contacts || [])];
                                                    contacts[idx].name = e.target.value;
                                                    setCurrentClient({ ...currentClient, contacts });
                                                }}
                                                placeholder="e.g. John Smith"
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <Input
                                                label="Email"
                                                value={contact.email}
                                                onChange={(e) => {
                                                    const contacts = [...(currentClient.contacts || [])];
                                                    contacts[idx].email = e.target.value;
                                                    setCurrentClient({ ...currentClient, contacts });
                                                }}
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <Input
                                                label="Phone"
                                                value={contact.phone}
                                                onChange={(e) => {
                                                    const formattedValue = formatPhoneNumber(e.target.value);
                                                    const contacts = [...(currentClient.contacts || [])];
                                                    contacts[idx].phone = formattedValue;
                                                    setCurrentClient({ ...currentClient, contacts });
                                                }}
                                                placeholder="(555) 000-0000"
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <Input
                                                label="Ext"
                                                value={contact.extension}
                                                onChange={(e) => {
                                                    const contacts = [...(currentClient.contacts || [])];
                                                    contacts[idx].extension = e.target.value;
                                                    setCurrentClient({ ...currentClient, contacts });
                                                }}
                                                placeholder="123"
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type & Status</label>
                                                <div className="flex items-center gap-3">
                                                    <select
                                                        value={contact.type}
                                                        onChange={(e) => {
                                                            const contacts = [...(currentClient.contacts || [])];
                                                            contacts[idx].type = e.target.value;
                                                            setCurrentClient({ ...currentClient, contacts });
                                                        }}
                                                        className="flex-1 h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#3282B8]/20 transition-all cursor-pointer"
                                                    >
                                                        <option value="Main Contact">Main</option>
                                                        <option value="Accounting">Accounting</option>
                                                        <option value="Secondary Contact">Secondary</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            const contacts = (currentClient.contacts || []).map((c, i) => ({
                                                                ...c,
                                                                active: i === idx
                                                            }));
                                                            setCurrentClient({ ...currentClient, contacts });
                                                        }}
                                                        className={`h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${contact.active ? 'bg-[#0F4C75] text-white border-[#0F4C75]' : 'bg-white text-slate-400 border-slate-200 hover:border-[#3282B8] hover:text-[#3282B8]'}`}
                                                    >
                                                        {contact.active ? 'ACTIVE' : 'SET ACTIVE'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {(!currentClient.contacts || currentClient.contacts.length === 0) && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                    <div className="text-slate-300 text-sm italic font-medium">No contacts added yet.</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Addresses Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-[#0F4C75]" />
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Addresses</h4>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    const addresses = [...(currentClient.addresses || [])];
                                    addresses.push('');
                                    setCurrentClient({ ...currentClient, addresses });
                                }}
                                className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider !bg-[#0F4C75]"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1.5" /> ADD ADDRESS
                            </Button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-3 thin-scrollbar">
                            {(currentClient.addresses || []).map((address, idx) => (
                                <div key={idx} className={`p-4 rounded-2xl border transition-all ${idx === 0 ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-100'} relative group flex gap-4 items-end`}>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {idx === 0 ? 'Primary Business Address' : `Additional Address ${idx + 1}`}
                                            </label>
                                            {idx === 0 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">MAIN TABLE ADDRESS</span>}
                                        </div>
                                        <Input
                                            value={address}
                                            onChange={(e) => {
                                                const addresses = [...(currentClient.addresses || [])];
                                                addresses[idx] = e.target.value;
                                                // If this is the first address, also update the main businessAddress
                                                const update: any = { addresses };
                                                if (idx === 0) update.businessAddress = e.target.value;
                                                setCurrentClient({ ...currentClient, ...update });
                                            }}
                                            placeholder="Enter full address line..."
                                            className="!bg-white"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const addresses = currentClient.addresses?.filter((_, i) => i !== idx);
                                            setCurrentClient({ ...currentClient, addresses, businessAddress: addresses?.[0] || '' });
                                        }}
                                        className="p-2.5 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-xl border border-slate-200"
                                    >
                                        <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                </div>
                            ))}

                            {(!currentClient.addresses || currentClient.addresses.length === 0) && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                    <div className="text-slate-300 text-sm italic font-medium">No addresses added yet.</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Client"
                message={`Are you sure you want to delete ${clientToDelete?.name}? This action cannot be undone.`}
                confirmText="Delete Client"
            />
        </div>
    );
}
