'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { Header, Button, AddButton, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, Badge, SkeletonTable, BadgeTabs } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface Contact {
    _id: string; // recordId
    fullName: string;
    clientName?: string;
    clientId?: string;
    title?: string;
    email?: string;
    phone?: string;
    status?: string;
}

export default function ContactsPage() {
    const { success, error } = useToast();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');
    const itemsPerPage = 15;

    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getContacts' })
            });
            const data = await res.json();
            if (data.success) {
                setContacts(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching contacts:', err);
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

                const parsedContacts = rows.slice(1).filter(r => r.trim()).map(row => {
                    // Simple CSV regex for splitting by comma but ignoring commas in quotes
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

                    const contact: any = {};
                    headers.forEach((h, i) => {
                        const key = h.replace(/^"|"$/g, '');
                        if (key && values[i]) contact[key] = values[i];
                    });
                    return contact;
                });

                if (parsedContacts.length === 0) throw new Error("No valid data found");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importContacts', payload: { contacts: parsedContacts } })
                });

                const data = await res.json();
                if (data.success) {
                    success(`Successfully imported ${parsedContacts.length} contacts`);
                    fetchContacts();
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

    // Calculate counts
    const counts = useMemo(() => {
        return {
            all: contacts.length,
            active: contacts.filter(c => c.status === 'Active').length,
            inactive: contacts.filter(c => c.status !== 'Active').length
        };
    }, [contacts]);

    // Filter and Search
    const filteredContacts = contacts.filter(c => {
        // Tab filter
        if (activeTab === 'active' && c.status !== 'Active') return false;
        if (activeTab === 'inactive' && c.status === 'Active') return false;

        // Search Filter
        if (search) {
            const lowerSearch = search.toLowerCase();
            return (
                (c.fullName || '').toLowerCase().includes(lowerSearch) ||
                (c.clientName || '').toLowerCase().includes(lowerSearch) ||
                (c.email || '').toLowerCase().includes(lowerSearch)
            );
        }
        return true;
    });

    const paginatedContacts = filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);

    const tabs = [
        { id: 'all', label: 'All Contacts', count: counts.all },
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
                            placeholder="Search contacts..."
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
                        <AddButton onClick={() => { }} label="New Contact" />
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
                                <TableHeader>Client</TableHeader>
                                <TableHeader>Title</TableHeader>
                                <TableHeader>Email</TableHeader>
                                <TableHeader>Phone</TableHeader>
                                <TableHeader>Status</TableHeader>
                                <TableHeader className="text-right">Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedContacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <p className="text-base font-medium text-gray-900">No contacts found</p>
                                            <p className="text-sm text-gray-500 mt-1">Get started by adding a new contact.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedContacts.map((contact) => (
                                    <TableRow key={contact._id}>
                                        <TableCell className="font-medium text-indigo-600">{contact.fullName}</TableCell>
                                        <TableCell>{contact.clientName || '-'}</TableCell>
                                        <TableCell>{contact.title || '-'}</TableCell>
                                        <TableCell>{contact.email || '-'}</TableCell>
                                        <TableCell>{contact.phone || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={contact.status === 'Active' ? 'success' : 'default'}>
                                                {contact.status || 'Active'}
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
