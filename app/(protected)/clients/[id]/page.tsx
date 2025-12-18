'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, RefreshCw, Trash2, ArrowLeft, Building, User, FileText, Briefcase, FileSpreadsheet, Plus, Pencil, Mail, Phone, MapPin } from 'lucide-react';

import { Header, ConfirmModal, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge, Modal, Input, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { ClientHeaderCard, AccordionCard, DetailRow } from './components';

// Types (Mirrors Client Interface)
interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
}

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
    contacts?: ClientContact[];
    addresses?: string[];
    [key: string]: any;
}




export default function ClientViewPage() {
    const router = useRouter();
    const params = useParams();
    const id = decodeURIComponent(params.id as string);
    const { success, error: toastError } = useToast();

    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [animate, setAnimate] = useState(false);



    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'company': true,
        'contacts': true,
        'addresses': true,
        'documents': false
    });

    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [newContact, setNewContact] = useState<ClientContact>({ name: '', email: '', phone: '' });

    const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
    const [newAddress, setNewAddress] = useState('');


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
            const clientRes = await apiCall('getClientById', { id });


            if (clientRes.success && clientRes.result) {
                setClient(clientRes.result);
                // Trigger animation on load
                setTimeout(() => setAnimate(true), 100);
            } else {
                toastError('Failed to load client');
                router.push('/clients');
            }



        } catch (err) {
            console.error('Error loading client:', err);
            toastError('Error loading client');
        }
        if (!silent) setLoading(false);
    };



    useEffect(() => {
        if (id) {
            loadClient();
        }
    }, [id]);

    const handleToggle = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleAddContact = async () => {
        if (!client || !newContact.name) return;
        const updatedContacts = [...(client.contacts || []), newContact];
        try {
            const res = await apiCall('updateClient', { id: client._id, item: { contacts: updatedContacts } });
            if (res.success) {
                setClient(res.result);
                setIsAddContactModalOpen(false);
                setNewContact({ name: '', email: '', phone: '' });
                success('Contact added');
            } else {
                toastError(res.error || 'Failed to add contact');
            }
        } catch (err) { toastError('Error adding contact'); }
    };


    const handleRemoveContact = async (index: number) => {
        if (!client || !client.contacts) return;
        const updatedContacts = client.contacts.filter((_, i) => i !== index);
        try {
            const res = await apiCall('updateClient', { id: client._id, item: { contacts: updatedContacts } });
            if (res.success) {
                setClient(res.result);
                success('Contact removed');
            } else {
                toastError(res.error || 'Failed to remove contact');
            }
        } catch (err) { toastError('Error removing contact'); }
    };


    const handleAddAddress = async () => {
        if (!client || !newAddress) return;
        const updatedAddresses = [...(client.addresses || []), newAddress];
        try {
            const res = await apiCall('updateClient', { id: client._id, item: { addresses: updatedAddresses } });
            if (res.success) {
                setClient(res.result);
                setIsAddAddressModalOpen(false);
                setNewAddress('');
                success('Address added');
            } else {
                toastError(res.error || 'Failed to add address');
            }
        } catch (err) { toastError('Error adding address'); }
    };


    const handleRemoveAddress = async (index: number) => {
        if (!client || !client.addresses) return;
        const updatedAddresses = client.addresses.filter((_, i) => i !== index);
        try {
            const res = await apiCall('updateClient', { id: client._id, item: { addresses: updatedAddresses } });
            if (res.success) {
                setClient(res.result);
                success('Address removed');
            } else {
                toastError(res.error || 'Failed to remove address');
            }
        } catch (err) { toastError('Error removing address'); }
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
                        onUpdate={() => { }}
                        animate={animate}
                    />


                    {/* Accordions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">


                        {/* Company Info */}
                        <AccordionCard
                            title="Company Information"
                            icon={Building}
                            isOpen={openSections['company']}
                            onToggle={() => handleToggle('company')}
                        >
                            <DetailRow label="Company Name" value={client.name} />
                            <DetailRow label="Primary Address" value={client.businessAddress} />
                            <DetailRow label="Proposal Writer" value={client.proposalWriter} />
                            <DetailRow label="Status" value={client.status} />
                        </AccordionCard>

                        {/* Contacts Card */}
                        <AccordionCard
                            title="Contacts"
                            icon={User}
                            isOpen={openSections['contacts']}
                            onToggle={() => handleToggle('contacts')}
                            rightElement={
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); setIsAddContactModalOpen(true); }} className="h-8 w-8 !p-0 rounded-full">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            }
                        >
                            <div className="flex flex-col">
                                {client.contacts && client.contacts.length > 0 ? (
                                    client.contacts.map((c, i) => (
                                        <div key={i} className="flex items-start justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 group">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm font-bold text-slate-700">{c.name}</div>
                                                {c.email && <div className="text-xs text-slate-500 flex items-center gap-2"><Mail className="w-3 h-3 text-indigo-400" /> {c.email}</div>}
                                                {c.phone && <div className="text-xs text-slate-500 flex items-center gap-2"><Phone className="w-3 h-3 text-emerald-400" /> {c.phone}</div>}
                                            </div>
                                            <button onClick={() => handleRemoveContact(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-sm text-slate-400 italic">No additional contacts</div>
                                )}
                            </div>
                        </AccordionCard>

                        {/* Addresses Card */}
                        <AccordionCard
                            title="Addresses"
                            icon={MapPin}
                            isOpen={openSections['addresses']}
                            onToggle={() => handleToggle('addresses')}
                            rightElement={
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); setIsAddAddressModalOpen(true); }} className="h-8 w-8 !p-0 rounded-full">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            }
                        >
                            <div className="flex flex-col">
                                {client.addresses && client.addresses.length > 0 ? (
                                    client.addresses.map((addr, i) => (
                                        <div key={i} className="flex items-start justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 group">
                                            <div className="flex items-start gap-3 flex-1">
                                                <MapPin className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                                                <span className="text-sm font-medium text-slate-600 leading-snug">{addr}</span>
                                            </div>
                                            <button onClick={() => handleRemoveAddress(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-sm text-slate-400 italic">No additional addresses</div>
                                )}
                            </div>
                        </AccordionCard>




                        {/* Documents & Agreements */}
                        <div className="col-span-1 md:col-span-2 xl:col-span-3">


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


            {/* Add Contact Modal */}
            <Modal
                isOpen={isAddContactModalOpen}
                onClose={() => setIsAddContactModalOpen(false)}
                title="Add New Contact"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsAddContactModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddContact} disabled={!newContact.name}>Add Contact</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Full Name *"
                        value={newContact.name}
                        onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                        placeholder="John Doe"
                    />
                    <Input
                        label="Email"
                        value={newContact.email}
                        onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                        placeholder="john@example.com"
                    />
                    <Input
                        label="Phone"
                        value={newContact.phone}
                        onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                    />
                </div>
            </Modal>

            {/* Add Address Modal */}
            <Modal
                isOpen={isAddAddressModalOpen}
                onClose={() => setIsAddAddressModalOpen(false)}
                title="Add New Address"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsAddAddressModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddAddress} disabled={!newAddress}>Add Address</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Address Line"
                        value={newAddress}
                        onChange={e => setNewAddress(e.target.value)}
                        placeholder="123 Main St, City, State ZIP"
                    />
                </div>
            </Modal>
        </>

    );
}
