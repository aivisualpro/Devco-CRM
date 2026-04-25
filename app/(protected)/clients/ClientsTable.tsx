'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Pencil, Trash2, FileText, Plus, Building, Building2, Mail, Phone, MapPin, User, Briefcase, Search, ChevronRight, X, MessageSquare } from 'lucide-react';
import { Header, Button, SearchInput, Pagination, Badge, BadgeTabs, Modal, ConfirmModal, Input, SearchableSelect, Tooltip, TooltipTrigger, TooltipContent, Switch, SegmentedControl } from '@/components/ui';
import { ClientForm, ClientFormValues } from "@/components/forms/ClientForm";
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { useInfiniteClients } from '@/lib/hooks/api';
import { DataTable, ColumnDef } from '@/components/data-table/DataTable';

interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string;
    active: boolean;
    primary?: boolean;
}

interface ClientAddress {
    address: string;
    primary: boolean;
}

interface Client {
    _id: string; // recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string; // This should be an employee ID/email
    contacts: ClientContact[];
    addresses?: (string | ClientAddress)[];
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

export default function ClientsTable({ initialData }: { initialData: any[] }) {
    const router = useRouter();
    const { can } = usePermissions();
    const { success, error } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState<Partial<Client>>(defaultClient);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const { items: clients, counts: backendCounts, isLoading: loading, isValidating, hasMore, size, setSize, mutate: refetchClients } = useInfiniteClients(
        { q: debouncedSearch, limit: 25, status: activeTab === 'all' ? '' : (activeTab === 'active' ? 'Active' : 'Inactive') },
        { fallbackData: initialData }
    );

    useEffect(() => {
        fetchEmployees();
    }, []);

    const counts = backendCounts || { all: 0, active: 0, inactive: 0 };
    const filteredClients = clients;

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
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
                    const client: any = {};
                    headers.forEach((h, i) => {
                        const key = h.replace(/^"|"$/g, '');
                        if (key && values[i]) client[key] = values[i];
                    });
                    return client;
                });

                if (parsedClients.length === 0) throw new Error("No valid data found");

                const res = await fetch(`/api/clients/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({parsedClients})
});

                const data = await res.json();
                if (data.success) {
                    success(`Successfully imported ${parsedClients.length} clients`);
                    refetchClients();
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

    const handleDelete = async () => {
        if (!clientToDelete) return;
        if (!can(MODULES.CLIENTS, ACTIONS.DELETE)) {
            error('You do not have permission to delete clients');
            return;
        }

        try {
            const res = await fetch(`/api/clients/${clientToDelete._id}`, { method: 'DELETE' });

            const data = await res.json();
            if (data.success) {
                success('Client deleted successfully');
                refetchClients();
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

    const columns: ColumnDef<Client>[] = [
        {
            key: 'name',
            header: 'Name',
            width: '200px',
            cell: (client) => <span className="line-clamp-2">{client.name}</span>
        },
        {
            key: 'address',
            header: 'Address',
            cell: (client) => (
                <div className="flex items-start gap-2 max-w-[200px]">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="line-clamp-2 leading-relaxed">
                                {client.businessAddress || '-'}
                            </span>
                        </TooltipTrigger>
                        {client.businessAddress && (
                            <TooltipContent>
                                <p>{client.businessAddress}</p>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>
            )
        },
        {
            key: 'writer',
            header: 'Writer',
            cell: (client) => {
                const writer = employees.find(e => e._id === client.proposalWriter || e.email === client.proposalWriter);
                return writer ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div 
                                className="relative w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] overflow-hidden border border-slate-200 shadow-sm"
                            >
                                {writer.profilePicture ? (
                                    <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(writer.profilePicture, { w: 1200 })} alt="" className="object-cover w-full h-full" /></div>
                                ) : (
                                    `${writer.firstName?.[0] || ''}${writer.lastName?.[0] || ''}` || '?'
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{`${writer.firstName} ${writer.lastName}`}</p>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <span className="text-gray-400 text-[10px] italic">N/A</span>
                );
            }
        },
        {
            key: 'contact',
            header: 'Contact',
            cell: (client) => {
                const primaryContact = client.contacts?.find(con => con.primary) || client.contacts?.find(con => con.active) || client.contacts?.[0];
                return <div className="line-clamp-1">{primaryContact?.name || '-'}</div>;
            }
        },
        {
            key: 'email',
            header: 'Email',
            cell: (client) => {
                const primaryContact = client.contacts?.find(con => con.primary) || client.contacts?.find(con => con.active) || client.contacts?.[0];
                return primaryContact?.email ? (
                    <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="line-clamp-1">{primaryContact.email}</span>
                    </div>
                ) : '-';
            }
        },
        {
            key: 'phone',
            header: 'Phone',
            cell: (client) => {
                const primaryContact = client.contacts?.find(con => con.primary) || client.contacts?.find(con => con.active) || client.contacts?.[0];
                return primaryContact?.phone ? (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {primaryContact.phone}
                    </div>
                ) : '-';
            }
        },
        {
            key: 'estimates',
            header: 'Estimates',
            cell: (client) => (
                <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-xs font-medium">
                        {(client as any).estimatesCount || 0}
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            cell: (client) => (
                <Badge variant={client.status === 'Active' ? 'success' : 'default'} className="text-[10px] uppercase tracking-wider">
                    {client.status || 'Active'}
                </Badge>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (client) => (
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {can(MODULES.CLIENTS, ACTIONS.EDIT) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => openEditModal(client)}
                                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Edit Client</p>
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {can(MODULES.CLIENTS, ACTIONS.DELETE) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => openDeleteModal(client)}
                                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Delete Client</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )
        }
    ];

    const toolbar = (
        <>
            <Header
                hideLogo={false}
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
                         {can(MODULES.CLIENTS, ACTIONS.CREATE) && (
                         <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="hidden lg:flex p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600 disabled:opacity-50"
                                        disabled={isImporting}
                                    >
                                        <Upload className={`w-4 h-4 ${isImporting ? 'animate-pulse' : ''}`} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isImporting ? 'Importing...' : 'Import CSV'}</p>
                                </TooltipContent>
                            </Tooltip>

                            <Button
                                onClick={openAddModal}
                                variant="default"
                                size="icon"
                                className="md:hidden rounded-full shadow-lg active:scale-95 transition-transform"
                            >
                                <Plus size={24} />
                            </Button>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={openAddModal}
                                        variant="default"
                                        size="icon"
                                        className="hidden md:flex rounded-full shadow-lg hover:shadow-slate-900/30 group"
                                    >
                                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>New Client</p>
                                </TooltipContent>
                            </Tooltip>
                        </>
                        )}
                    </div>
                }
            />
            <div className="hidden lg:flex justify-center mb-2 px-4">
                <BadgeTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </div>
        </>
    );

    const mobileCard = (client: Client) => {
        const writer = employees.find(e => e._id === client.proposalWriter || e.email === client.proposalWriter);
        const primaryContact = client.contacts?.find(con => con.primary) || client.contacts?.find(con => con.active) || client.contacts?.[0];

        return (
            <div
                className="bg-white rounded-2xl p-3 shadow-sm border border-slate-50 hover:border-slate-100 transition-all active:scale-[0.98] flex flex-col min-h-[140px] cursor-pointer"
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

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="relative w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-normal text-slate-600 border border-slate-200 overflow-hidden shadow-sm"
                            >
                                {writer?.profilePicture ? (
                                    <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(writer.profilePicture, { w: 1200 })} className="object-cover w-full h-full" /></div>
                                ) : (
                                    writer ? `${writer.firstName?.[0] || ''}${writer.lastName?.[0] || ''}` : '?'
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{writer ? `${writer.firstName} ${writer.lastName}` : 'Unassigned'}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full flex flex-col">
            <DataTable
                columns={columns}
                data={filteredClients}
                isLoading={loading}
                isLoadingMore={isValidating && !loading}
                hasMore={hasMore}
                onLoadMore={() => setSize(size + 1)}
                emptyState={{ 
                    icon: <Building2 className="w-12 h-12" />, 
                    title: 'No clients found', 
                    description: 'Get started by adding a new client.' 
                }}
                onRowClick={(client) => router.push(`/clients/${client._id}`)}
                toolbar={toolbar}
                mobileCard={mobileCard}
            />

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={currentClient._id ? 'Edit Client' : 'New Client'}
                footer={null}
            >
                <ClientForm
                    initialData={currentClient as any}
                    employees={employees as any}
                    onSubmit={async (data) => {
                        try {
                            const isEdit = !!data._id;
                            const action = isEdit ? 'updateClient' : 'addClient';
                            const payload = isEdit
                                ? { id: data._id, item: data }
                                : { item: data };

                            const res = await fetch('/api/webhook/devcoBackend', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action, payload })
                            });

                            const resData = await res.json();
                            if (resData.success) {
                                success(isEdit ? 'Client updated successfully' : 'Client added successfully');
                                setIsModalOpen(false);
                                refetchClients();
                            } else {
                                error('Failed to save client: ' + (resData.error || 'Unknown error'));
                            }
                        } catch (err) {
                            console.error('Error saving client:', err);
                            error('An error occurred while saving');
                        }
                    }}
                    onCancel={() => setIsModalOpen(false)}
                />
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
