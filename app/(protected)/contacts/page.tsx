'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { Header, Button, AddButton, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, Badge, SkeletonTable, BadgeTabs, Modal, ConfirmModal, Input, SearchableSelect } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface Contact {
    _id: string; // recordId
    fullName: string;
    clientName?: string;
    clientId?: string;
    title?: string;
    email?: string;
    phone?: string;
    address?: string; // Added address
    status?: string;
    isKeyContact?: boolean;
}

interface Client {
    _id: string;
    name: string;
}

const defaultContact: Partial<Contact> = {
    fullName: '',
    clientName: '',
    clientId: '',
    title: '',
    email: '',
    phone: '',
    status: 'Active'
};

export default function ContactsPage() {
    const { success, error } = useToast();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');
    const [itemsPerPage] = useState(15);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentContact, setCurrentContact] = useState<Partial<Contact>>(defaultContact);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

    // Clients Integration
    const [clients, setClients] = useState<Client[]>([]);

    // Quick Client Add State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');

    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        fetchContacts();
        fetchClients();
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', { method: 'POST', body: JSON.stringify({ action: 'getContacts' }) });
            const data = await res.json();
            if (data.success) setContacts(data.result || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const fetchClients = async () => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', { method: 'POST', body: JSON.stringify({ action: 'getClients' }) });
            const data = await res.json();
            if (data.success) setClients(data.result || []);
        } catch (err) { console.error(err); }
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

                const parsedContacts = rows.slice(1).filter(r => r.trim()).map((row, rowIndex) => {
                    // Simple CSV regex for splitting by comma but ignoring commas in quotes
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

                    const contact: any = {};
                    headers.forEach((h, i) => {
                        const header = h.replace(/^"|"$/g, '').trim();
                        const val = values[i] || '';

                        // Header Mapping
                        if (header === 'contactFullName') contact.fullName = val;
                        else if (header === 'designation') contact.title = val;
                        else if (header === 'clientId') contact.clientId = val;
                        else if (header === 'email') contact.email = val;
                        else if (header === 'phone') contact.phone = val;
                        else if (header === 'address' || header === 'jobAddress') contact.address = val;
                        // Add extension to phone if present
                        else if (header === 'extension' && val) {
                            contact.phone = contact.phone ? `${contact.phone} x${val}` : `x${val}`;
                        }
                        // Default fallback
                        else if (header && val) contact[header] = val;

                        // Key Contact Mapping (Try to match various CSV header styles)
                        if (header.toLowerCase() === 'iskeycontact' || header.toLowerCase() === 'keycontact' || header === 'isKeyContact') {
                            contact.isKeyContact = (val === 'TRUE' || val === 'true' || val === '1' || val === 'Y' || val === 'y');
                        }
                    });

                    // Generate ID if missing
                    if (!contact._id) {
                        contact._id = `CT-${Date.now()}-${rowIndex}-${Math.floor(Math.random() * 1000)}`;
                    }

                    // Lookup Client Name if clientId is present but clientName is not
                    if (contact.clientId && !contact.clientName) {
                        const client = clients.find(c => c._id === contact.clientId);
                        if (client) contact.clientName = client.name;
                    }

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

    // CRUD
    const openAddModal = () => {
        setCurrentContact({ ...defaultContact });
        setIsModalOpen(true);
    };

    const openEditModal = (contact: Contact) => {
        setCurrentContact({ ...contact });
        setIsModalOpen(true);
    };

    const openDeleteModal = (contact: Contact) => {
        setContactToDelete(contact);
        setIsDeleteModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentContact.fullName) return error('Name is required');

        // Find client ID if only name is present (edge case)
        if (currentContact.clientName && !currentContact.clientId) {
            const matched = clients.find(c => c.name === currentContact.clientName);
            if (matched) currentContact.clientId = matched._id;
        }

        try {
            const isEdit = !!currentContact._id;
            const action = isEdit ? 'updateContact' : 'addContact';
            const payload = isEdit ? { id: currentContact._id, item: currentContact } : { item: currentContact };

            const res = await fetch('/api/webhook/devcoBackend', { method: 'POST', body: JSON.stringify({ action, payload }) });
            const data = await res.json();

            if (data.success) {
                success('Contact saved');
                setIsModalOpen(false);
                fetchContacts();
            } else {
                error('Failed to save');
            }
        } catch (err) { error('Error saving contact'); }
    };

    const handleDelete = async () => {
        if (!contactToDelete) return;
        const res = await fetch('/api/webhook/devcoBackend', { method: 'POST', body: JSON.stringify({ action: 'deleteContact', payload: { id: contactToDelete._id } }) });
        const data = await res.json();
        if (data.success) {
            success('Contact deleted');
            fetchContacts();
        } else {
            error('Failed to delete');
        }
        setIsDeleteModalOpen(false);
        setContactToDelete(null);
    };

    // Client Add Logic
    const openNewClientModal = (name: string) => {
        setNewClientName(name);
        setIsClientModalOpen(true);
    };

    const handleSaveNewClient = async () => {
        if (!newClientName) return error('Client name required');

        const res = await fetch('/api/webhook/devcoBackend', {
            method: 'POST',
            body: JSON.stringify({ action: 'addClient', payload: { item: { name: newClientName, status: 'Active' } } })
        });
        const data = await res.json();

        if (data.success) {
            success('Client added');
            await fetchClients(); // Refresh list to include new client

            // Auto-select the new client in the contact form
            setCurrentContact({
                ...currentContact,
                clientName: newClientName,
                clientId: data.result._id
            });
            setIsClientModalOpen(false);
        } else {
            error('Failed to add client');
        }
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
                            ref={fileInputRef}
                            onChange={handleImport}
                            accept=".csv"
                            className="hidden"
                        />
                        <Button
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            {isImporting ? 'Importing...' : 'Import CSV'}
                        </Button>
                        <AddButton onClick={openAddModal} label="New Contact" />
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
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Name</TableHeader>
                                <TableHeader>Client</TableHeader>
                                <TableHeader>Title</TableHeader>
                                <TableHeader>Email</TableHeader>
                                <TableHeader>Phone</TableHeader>
                                <TableHeader>Address</TableHeader>
                                <TableHeader>Status</TableHeader>
                                <TableHeader className="text-right">Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedContacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
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
                                        <TableCell className="max-w-[200px] truncate" title={contact.address || ''}>{contact.address || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={contact.status === 'Active' ? 'success' : 'default'}>
                                                {contact.status || 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(contact)}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openDeleteModal(contact)}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
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
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>

            {/* Add/Edit Contact Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={currentContact._id ? 'Edit Contact' : 'New Contact'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Contact</Button>
                    </>
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <Input
                            value={currentContact.fullName || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, fullName: e.target.value })}
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client (Company) *</label>
                        <SearchableSelect
                            value={currentContact.clientName || ''}
                            onChange={(val) => {
                                const client = clients.find(c => c.name === val);
                                setCurrentContact({
                                    ...currentContact,
                                    clientName: val,
                                    clientId: client?._id
                                });
                            }}
                            options={clients.map(c => c.name)}
                            placeholder="Select or add client..."
                            onAddNew={openNewClientModal}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <Input
                            value={currentContact.title || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, title: e.target.value })}
                            placeholder="Project Manager"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <Input
                            value={currentContact.email || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, email: e.target.value })}
                            placeholder="email@example.com"
                            type="email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <Input
                            value={currentContact.phone || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, phone: e.target.value })}
                            placeholder="(555) 555-5555"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <Input
                            value={currentContact.address || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, address: e.target.value })}
                            placeholder="123 Main St, City, State ZIP"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={currentContact.status || 'Active'}
                            onChange={(e) => setCurrentContact({ ...currentContact, status: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <div className="col-span-2 flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="isKeyContact"
                            checked={currentContact.isKeyContact || false}
                            onChange={(e) => setCurrentContact({ ...currentContact, isKeyContact: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="isKeyContact" className="text-sm font-medium text-gray-700">
                            Set as Key Contact
                        </label>
                    </div>
                </div>
            </Modal>

            {/* Quick Add Client Modal */}
            <Modal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                title="New Client"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsClientModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveNewClient}>Create Client</Button>
                    </>
                }
            >
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                    <Input
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Enter new client name"
                        autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        You can add more details later in the Clients section.
                    </p>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Contact"
                message={`Are you sure you want to delete ${contactToDelete?.fullName}? This action cannot be undone.`}
                confirmText="Delete Contact"

            />
        </>
    );
}
