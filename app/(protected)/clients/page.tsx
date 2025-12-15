'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { Header, Button, AddButton, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, Badge, SkeletonTable, BadgeTabs } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface Client {
    _id: string; // recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string;
    contactFullName?: string;
    email?: string;
    phone?: string;
    accountingContact?: string;
    accountingEmail?: string;
    agreementFile?: string;
    status?: string;
}

export default function ClientsPage() {
    const { success, error } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');
    const itemsPerPage = 15;

    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        fetchClients();
    }, []);

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
                    // Simple CSV parsing (handles simple commas, assumes no commas in values for MVP or uses regex)
                    // Better regex for CSV: /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

                    const client: any = {};
                    headers.forEach((h, i) => {
                        // Map CSV headers to model fields (camelCase)
                        // Expected headers: recordId, name, businessAddress, etc.
                        // Or map known headers
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

    // Calculate tab counts
    const counts = useMemo(() => {
        return {
            all: clients.length,
            active: clients.filter(c => c.status === 'Active').length,
            inactive: clients.filter(c => c.status !== 'Active').length
        };
    }, [clients]);

    // Filter by Tab then Search
    const filteredClients = clients.filter(c => {
        // Tab filter
        if (activeTab === 'active' && c.status !== 'Active') return false;
        if (activeTab === 'inactive' && c.status === 'Active') return false;

        // Search filter
        if (search) {
            const lowerSearch = search.toLowerCase();
            return (
                (c.name || '').toLowerCase().includes(lowerSearch) ||
                (c.email || '').toLowerCase().includes(lowerSearch) ||
                (c.contactFullName || '').toLowerCase().includes(lowerSearch)
            );
        }
        return true;
    });

    const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

    const tabs = [
        { id: 'all', label: 'All Clients', count: counts.all },
        { id: 'active', label: 'Active', count: counts.active },
        { id: 'inactive', label: 'Inactive', count: counts.inactive }
    ];

    return (
        <>
            <Header
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search clients..."
                            className="w-64"
                        />
                        <input
                            type="file"
                            accept=".csv"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImport}
                        />
                        <Button
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white border text-gray-700 hover:bg-gray-50"
                            disabled={isImporting}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            {isImporting ? 'Importing...' : 'Import CSV'}
                        </Button>
                        <AddButton onClick={() => { }} label="New Client" />
                    </div>
                }
            />

            <div className="p-4">
                {/* Tabs */}
                <div className="flex justify-center mb-4">
                    <BadgeTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>

                {loading ? (
                    <SkeletonTable rows={10} columns={7} />
                ) : (
                    <Table containerClassName="h-[calc(100vh-220px)] overflow-auto">
                        <TableHead>
                            <TableRow>
                                <TableHeader>Name</TableHeader>
                                <TableHeader>Contact</TableHeader>
                                <TableHeader>Email</TableHeader>
                                <TableHeader>Phone</TableHeader>
                                <TableHeader>Address</TableHeader>
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
                                paginatedClients.map((client) => (
                                    <TableRow key={client._id}>
                                        <TableCell className="font-medium text-indigo-600">{client.name}</TableCell>
                                        <TableCell>{client.contactFullName || '-'}</TableCell>
                                        <TableCell>{client.email || '-'}</TableCell>
                                        <TableCell>{client.phone || '-'}</TableCell>
                                        <TableCell>
                                            <span title={client.businessAddress} className="block max-w-xs truncate">
                                                {client.businessAddress || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={client.status === 'Active' ? 'success' : 'default'}>
                                                {client.status || 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all">
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
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
        </>
    );
}
