'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, RefreshCw, Trash2, ArrowLeft, Building, User, FileText, Briefcase, FileSpreadsheet, Plus, Pencil } from 'lucide-react';
import { Header, ConfirmModal, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge, Modal, Input, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { ClientHeaderCard, AccordionCard, DetailRow } from './components';

// Types (Mirrors Client Interface)
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
    [key: string]: any;
}

interface Contact {
    _id: string;
    fullName: string;
    clientName?: string;
    clientId?: string;
    title?: string;
    email?: string;
    phone?: string;
    address?: string; // Added field
    status?: string;
    isKeyContact?: boolean;
}

const defaultContact: Partial<Contact> = {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    status: 'Active',
    isKeyContact: false
};

export default function ClientViewPage() {
    const router = useRouter();
    const params = useParams();
    const id = decodeURIComponent(params.id as string);
    const { success, error: toastError } = useToast();

    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [animate, setAnimate] = useState(false);

    // Contacts State
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [currentContact, setCurrentContact] = useState<Partial<Contact>>(defaultContact);
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
    const [isDeleteContactModalOpen, setIsDeleteContactModalOpen] = useState(false);

    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'company': true,
        'contacts': true,
        'documents': false
    });

    const [confirmDelete, setConfirmDelete] = useState(false);

    // API Call Helper
    const apiCall = async (action: string, payload: Record<string, unknown> = {}) => {
        const res = await fetch('/api/webhook/devcoBackend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        return res.json();
    };

    const loadClient = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [clientRes, contactRes] = await Promise.all([
                apiCall('getClientById', { id }),
                apiCall('getContacts') // Ideally filter by ID backend-side, but client-side for now
            ]);

            if (clientRes.success && clientRes.result) {
                setClient(clientRes.result);
                // Trigger animation on load
                setTimeout(() => setAnimate(true), 100);
            } else {
                toastError('Failed to load client');
                router.push('/clients');
            }

            if (contactRes.success && contactRes.result && Array.isArray(contactRes.result)) {
                // Filter contacts for this client
                // ID matching handles both string and potentially mismatched types safely
                const related = contactRes.result.filter((c: Contact) => c.clientId === id || c.clientName === clientRes.result?.name);
                setContacts(related);
            }

        } catch (err) {
            console.error('Error loading client:', err);
            toastError('Error loading client');
        }
        if (!silent) setLoading(false);
    };

    // Contact CRUD
    const openAddContactModal = () => {
        setCurrentContact({
            ...defaultContact,
            clientName: client?.name,
            clientId: client?._id
        });
        setIsContactModalOpen(true);
    };

    const openEditContactModal = (contact: Contact) => {
        setCurrentContact({ ...contact });
        setIsContactModalOpen(true);
    };

    const handleSaveContact = async () => {
        if (!currentContact.fullName) return toastError('Name is required');

        try {
            const isEdit = !!currentContact._id;
            const action = isEdit ? 'updateContact' : 'addContact';
            const payload = isEdit ? { id: currentContact._id, item: currentContact } : { item: currentContact };

            const res = await apiCall(action, payload);

            if (res.success) {
                success('Contact saved');
                setIsContactModalOpen(false);
                loadClient(true); // Reload to refresh list
            } else {
                toastError('Failed to save contact');
            }
        } catch (err) { toastError('Error saving contact'); }
    };

    const handleDeleteContact = async () => {
        if (!contactToDelete) return;
        try {
            const res = await apiCall('deleteContact', { id: contactToDelete._id });
            if (res.success) {
                success('Contact deleted');
                setIsDeleteContactModalOpen(false);
                loadClient(true);
            } else {
                toastError('Failed to delete contact');
            }
        } catch (err) { toastError('Error deleting contact'); }
    };

    useEffect(() => {
        if (id) {
            loadClient();
        }
    }, [id]);

    const handleToggle = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleDelete = async () => {
        if (!client) return;
        try {
            const res = await apiCall('deleteClient', { id: client._id });
            if (res.success) {
                success('Client deleted successfully');
                router.push('/clients');
            } else {
                toastError('Failed to delete client');
            }
        } catch (err) {
            toastError('Error deleting client');
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="flex-1 p-8 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-medium">Loading Client Profile...</p>
                    </div>
                </div>
            </>
        );
    }

    if (!client) return null;

    return (
        <>
            <Header
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/clients')}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Back to List"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1" />

                        <button
                            onClick={() => loadClient(true)}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete Client"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto bg-gray-50/50">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-[1600px] mx-auto">

                    {/* Hero Header Card */}
                    <ClientHeaderCard
                        client={client}
                        activeContact={contacts.find(c => c.isKeyContact)}
                        onUpdate={() => { }}
                        animate={animate}
                    />

                    {/* Accordions Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                        {/* Company Info */}
                        <AccordionCard
                            title="Company Information"
                            icon={Building}
                            isOpen={openSections['company']}
                            onToggle={() => handleToggle('company')}
                        >
                            <DetailRow label="Company Name" value={client.name} />
                            <DetailRow label="Address" value={client.businessAddress} />
                            <DetailRow label="Proposal Writer" value={client.proposalWriter} />
                            <DetailRow label="Status" value={client.status} />
                        </AccordionCard>

                        {/* Related Contacts */}
                        <div className="col-span-1">
                            <AccordionCard
                                title="Related Contacts"
                                icon={User}
                                isOpen={openSections['contacts']}
                                onToggle={() => handleToggle('contacts')}
                                rightElement={
                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); openAddContactModal(); }} className="gap-2 h-8">
                                        <Plus className="w-4 h-4" /> Add Contact
                                    </Button>
                                }
                            >
                                {contacts.length === 0 ? (
                                    <div className="text-center py-6 text-gray-500 text-sm">
                                        No contacts found for this client.
                                    </div>
                                ) : (
                                    <Table containerClassName="h-[180px] overflow-y-auto custom-scrollbar text-sm">
                                        <TableHead>
                                            <TableRow>
                                                <TableHeader>Name</TableHeader>
                                                <TableHeader>Title</TableHeader>
                                                <TableHeader>Email</TableHeader>
                                                <TableHeader>Phone</TableHeader>

                                                <TableHeader className="text-right">Actions</TableHeader>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {contacts.map((contact) => (
                                                <TableRow key={contact._id}>
                                                    <TableCell className="font-medium text-indigo-600">{contact.fullName}</TableCell>
                                                    <TableCell>{contact.title || '-'}</TableCell>
                                                    <TableCell>{contact.email || '-'}</TableCell>
                                                    <TableCell>{contact.phone || '-'}</TableCell>

                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => openEditContactModal(contact)}
                                                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setContactToDelete(contact); setIsDeleteContactModalOpen(true); }}
                                                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </AccordionCard>
                        </div>

                        {/* Documents & Agreements */}
                        <div className="col-span-1 xl:col-span-2">
                            <AccordionCard
                                title="Documents & Agreements"
                                icon={FileText}
                                isOpen={openSections['documents']}
                                onToggle={() => handleToggle('documents')}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <div>
                                        <DetailRow label="Service Agreement" value={client.agreementFile} isLink href={client.agreementFile} />
                                    </div>
                                    <div>
                                        {/* Placeholder for future documents */}
                                        <DetailRow label="Master Service Agreement (MSA)" value="-" />
                                    </div>
                                </div>
                            </AccordionCard>
                        </div>
                    </div>

                </div>
            </main>

            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title="Delete Client"
                message="Are you sure you want to delete this client? This action cannot be undone."
                confirmText="Delete Client"
            />

            {/* Add/Edit Contact Modal */}
            <Modal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                title={currentContact._id ? 'Edit Contact' : 'New Contact'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsContactModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveContact}>Save Contact</Button>
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

                    {/* Client Name is readonly/pre-filled */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                        <Input value={client?.name || ''} disabled className="bg-gray-100" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <Input
                            value={currentContact.title || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, title: e.target.value })}
                            placeholder="Role/Title"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <Input
                            value={currentContact.email || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, email: e.target.value })}
                            type="email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <Input
                            value={currentContact.phone || ''}
                            onChange={(e) => setCurrentContact({ ...currentContact, phone: e.target.value })}
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
                            id="isKeyContactClient"
                            checked={currentContact.isKeyContact || false}
                            onChange={(e) => setCurrentContact({ ...currentContact, isKeyContact: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="isKeyContactClient" className="text-sm font-medium text-gray-700">
                            Set as Key Contact
                        </label>
                    </div>
                </div>
            </Modal>

            {/* Delete Contact Confirmation */}
            <ConfirmModal
                isOpen={isDeleteContactModalOpen}
                onClose={() => setIsDeleteContactModalOpen(false)}
                onConfirm={handleDeleteContact}
                title="Delete Contact"
                message={`Are you sure you want to delete ${contactToDelete?.fullName}?`}
                confirmText="Delete"
            />
        </>
    );
}
