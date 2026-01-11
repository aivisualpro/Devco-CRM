'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Save, Trash2, ArrowLeft, Building, User, FileText, Briefcase, FileSpreadsheet, Plus, Pencil, Mail, Phone, MapPin, Upload } from 'lucide-react';

import { Header, ConfirmModal, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Badge, Modal, Input, Button, SearchableSelect } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { ClientHeaderCard, AccordionCard, DetailRow, DocumentGallery, DocumentPreviewModal } from './components';

// Types (Mirrors Client Interface)
interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string;
    active: boolean;
    address?: string;
}

interface ClientDocument {
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: string;
    category?: string;
    uploadedAt?: string | Date;
}

interface Client {
    _id: string; // recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string;
    status?: string;
    contacts?: ClientContact[];
    addresses?: string[];
    documents?: ClientDocument[];
    [key: string]: any;
}



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

export default function ClientViewPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const id = decodeURIComponent(params.id as string);
    const fromPath = searchParams.get('from');
    const { success, error: toastError } = useToast();

    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [animate, setAnimate] = useState(false);

    // Preview state
    const [selectedDoc, setSelectedDoc] = useState<ClientDocument | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);



    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'contacts': true,
        'addresses': true,
        'documents': false
    });

    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [newContact, setNewContact] = useState<ClientContact>({ name: '', email: '', phone: '', type: 'Main Contact', active: false, address: '' });

    const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
    const [newAddress, setNewAddress] = useState('');

    const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
    const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);


    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState<Partial<Client>>({});
    const [employees, setEmployees] = useState<any[]>([]);

    // Document Upload State
    const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newDoc, setNewDoc] = useState<{ name: string, category: string, file: string | null, type: string | null }>({
        name: '',
        category: 'Service Agreement',
        file: null,
        type: null
    });

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

        const fetchEmployees = async () => {
            try {
                const res = await apiCall('getEmployees');
                if (res.success) {
                    setEmployees(res.result || []);
                }
            } catch (err) {
                console.error('Error fetching employees:', err);
            }
        };
        fetchEmployees();
    }, [id]);

    const handleEditClient = () => {
        if (!client) return;
        setCurrentClient({ ...client });
        setIsEditModalOpen(true);
    };

    const handleSaveClient = async () => {
        if (!currentClient.name) {
            toastError('Client Name is required');
            return;
        }

        try {
            const res = await apiCall('updateClient', { id: client?._id, item: currentClient });

            if (res.success) {
                success('Client updated successfully');
                setIsEditModalOpen(false);
                loadClient(true);
            } else {
                toastError('Failed to save client: ' + (res.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error saving client:', err);
            toastError('An error occurred while saving');
        }
    };

    const handleToggle = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };



    const processContactWithNewAddress = (contact: ClientContact, currentAddresses: string[]): { contact: ClientContact, updatedAddresses: string[] | null } => {
        if (!contact.address || contact.address.trim() === '') return { contact, updatedAddresses: null };
        
        const address = contact.address.trim();
        // Check if this address is already in any list
        const exists = currentAddresses.some(a => a.toLowerCase() === address.toLowerCase()) ||
                     (client?.businessAddress?.toLowerCase() === address.toLowerCase());
        
        if (!exists) {
            return {
                contact,
                updatedAddresses: [...currentAddresses, address]
            };
        }
        return { contact, updatedAddresses: null };
    };

    const handleAddContactWithAddressCheck = async () => {
        if (!client || !newContact.name) return;

        const { contact, updatedAddresses } = processContactWithNewAddress(newContact, client.addresses || []);
        
        // If this is marked as active, deactivate others
        let updatedContacts = [...(client.contacts || [])];
        if (contact.active) {
            updatedContacts = updatedContacts.map(c => ({ ...c, active: false }));
        }
        if (updatedContacts.length === 0) {
            contact.active = true;
        }

        updatedContacts.push(contact);

        const payload: any = { contacts: updatedContacts };
        if (updatedAddresses) payload.addresses = updatedAddresses;

        try {
            const res = await apiCall('updateClient', { id: client._id, item: payload });
            if (res.success) {
                setClient(res.result);
                setIsAddContactModalOpen(false);
                setNewContact({ name: '', email: '', phone: '', type: 'Main Contact', active: false, address: '' });
                success('Contact added' + (updatedAddresses ? ' and new address saved' : ''));
            } else {
                toastError(res.error || 'Failed to add contact');
            }
        } catch (err) { toastError('Error adding contact'); }
    };


    const handleRemoveContact = async (index: number) => {
        if (!client || !client.contacts) return;
        const updatedContacts = client.contacts.filter((_, i) => i !== index);

        // If we removed the active one, mark the first remaining one as active
        if (client.contacts[index].active && updatedContacts.length > 0) {
            updatedContacts[0].active = true;
        }

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

    const handleSetActiveContact = async (index: number) => {
        if (!client || !client.contacts) return;
        const updatedContacts = client.contacts.map((c, i) => ({
            ...c,
            active: i === index
        }));
        try {
            const res = await apiCall('updateClient', { id: client._id, item: { contacts: updatedContacts } });
            if (res.success) {
                setClient(res.result);
                success('Primary contact updated');
            } else {
                toastError(res.error || 'Failed to update primary contact');
            }
        } catch (err) { toastError('Error updating primary contact'); }
    };

    const handleEditContact = (index: number) => {
        const contact = client?.contacts?.[index];
        if (contact) {
            setNewContact({ ...contact });
            setEditingContactIndex(index);
            setIsAddContactModalOpen(true);
        }
    };



    const handleUpdateContactWithAddressCheck = async () => {
        if (!client || !newContact.name || editingContactIndex === null) return;

        const { contact, updatedAddresses } = processContactWithNewAddress(newContact, client.addresses || []);

        let updatedContacts = [...(client.contacts || [])];
        if (contact.active) {
            updatedContacts = updatedContacts.map(c => ({ ...c, active: false }));
        }
        updatedContacts[editingContactIndex] = contact;

        const payload: any = { contacts: updatedContacts };
        if (updatedAddresses) payload.addresses = updatedAddresses;

        try {
            const res = await apiCall('updateClient', { id: client._id, item: payload });
            if (res.success) {
                setClient(res.result);
                setIsAddContactModalOpen(false);
                setEditingContactIndex(null);
                setNewContact({ name: '', email: '', phone: '', type: 'Main Contact', active: false, address: '' });
                success('Contact updated' + (updatedAddresses ? ' and new address saved' : ''));
            } else {
                toastError(res.error || 'Failed to update contact');
            }
        } catch (err) { toastError('Error updating contact'); }
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

    const handleEditAddress = (index: number) => {
        const address = client?.addresses?.[index];
        if (address) {
            setNewAddress(address);
            setEditingAddressIndex(index);
            setIsAddAddressModalOpen(true);
        }
    };

    const handleUpdateAddress = async () => {
        if (!client || !newAddress || editingAddressIndex === null) return;
        const updatedAddresses = [...(client.addresses || [])];
        updatedAddresses[editingAddressIndex] = newAddress;
        try {
            const res = await apiCall('updateClient', { id: client._id, item: { addresses: updatedAddresses } });
            if (res.success) {
                setClient(res.result);
                setIsAddAddressModalOpen(false);
                setEditingAddressIndex(null);
                setNewAddress('');
                success('Address updated');
            } else {
                toastError(res.error || 'Failed to update address');
            }
        } catch (err) { toastError('Error updating address'); }
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

    const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setNewDoc(prev => ({
                ...prev,
                file: event.target?.result as string,
                type: file.type,
                name: prev.name || file.name
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleBulkUpload = async (files: File[]) => {
        if (!client) return;
        setIsUploading(true);

        const newDocuments: ClientDocument[] = [];

        for (const file of files) {
            try {
                // Read file as base64
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });

                // 1. Upload to R2
                const uploadRes = await apiCall('uploadDocument', {
                    file: base64,
                    fileName: `${client.name?.replace(/\s+/g, '_')}_${file.name.replace(/\s+/g, '_')}_${Date.now()}`,
                    contentType: file.type
                });

                if (uploadRes.success) {
                    const docUrl = uploadRes.result;
                    let thumbnailUrl = '';

                    // 2. Generate Thumbnail if PDF/Image
                    const isPDF = file.type?.includes('pdf');
                    const isImage = file.type?.startsWith('image/');

                    if (isImage || isPDF) {
                        try {
                            const thumbRes = await apiCall('uploadThumbnail', {
                                file: base64,
                                fileName: `thumb_${Date.now()}`,
                                contentType: file.type
                            });
                            if (thumbRes.success) thumbnailUrl = thumbRes.result;
                        } catch (e) { console.error('Thumb error:', e); }
                    }

                    newDocuments.push({
                        name: file.name,
                        url: docUrl,
                        thumbnailUrl,
                        type: file.type || 'application/octet-stream',
                        uploadedAt: new Date()
                    });
                }
            } catch (err) {
                console.error(`Error uploading ${file.name}:`, err);
            }
        }

        if (newDocuments.length > 0) {
            const currentDocs = Array.isArray(client.documents) ? client.documents : [];
            const updatedDocs = [...currentDocs, ...newDocuments];

            const updateRes = await apiCall('updateClient', {
                id: client._id,
                item: { documents: updatedDocs }
            });

            if (updateRes.success) {
                setClient(updateRes.result);
                success(`Successfully uploaded ${newDocuments.length} document(s)`);
            } else {
                toastError('Failed to update client with new documents');
            }
        }
        setIsUploading(false);
    };

    const handleSaveDoc = async () => {
        if (!client || !newDoc.file) return;

        setIsUploading(true);
        try {
            // 1. Upload to R2 (Original File)
            const uploadRes = await apiCall('uploadDocument', {
                file: newDoc.file,
                fileName: `${client.name?.replace(/\s+/g, '_')}_${newDoc.name?.replace(/\s+/g, '_')}_${Date.now()}`,
                contentType: newDoc.type
            });

            if (uploadRes.success) {
                const docUrl = uploadRes.result;
                let thumbnailUrl = '';

                // 2. Generate and Upload Thumbnail to Cloudinary
                try {
                    const isPDF = newDoc.type?.includes('pdf');
                    const isImage = newDoc.type?.startsWith('image/');

                    if (isImage || isPDF) {
                        const thumbRes = await apiCall('uploadThumbnail', {
                            file: newDoc.file,
                            fileName: `thumb_${Date.now()}`,
                            contentType: newDoc.type
                        });
                        if (thumbRes.success) thumbnailUrl = thumbRes.result;
                    }
                } catch (thumbErr) {
                    console.error('Thumbnail Generation Error:', thumbErr);
                }

                const docToSave: ClientDocument = {
                    name: newDoc.name,
                    url: docUrl,
                    thumbnailUrl: thumbnailUrl,
                    type: newDoc.type || 'application/octet-stream',
                    category: newDoc.category,
                    uploadedAt: new Date()
                };

                // 3. Add to Client documents array
                const currentDocs = Array.isArray(client.documents) ? client.documents : [];
                const updatedDocs = [...currentDocs, docToSave];

                const updateRes = await apiCall('updateClient', {
                    id: client._id,
                    item: { documents: updatedDocs }
                });

                if (updateRes.success) {
                    setClient(updateRes.result);
                    setIsAddDocModalOpen(false);
                    setNewDoc({ name: '', category: 'Service Agreement', file: null, type: null });
                    success('Document uploaded with thumbnail');
                } else {
                    toastError(updateRes.error || 'Failed to link document to client');
                }
            } else {
                toastError(uploadRes.error || 'Failed to upload document');
            }
        } catch (err: any) {
            console.error('Doc Upload Error:', err);
            toastError(err.message || 'Error during upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveDoc = async (index: number) => {
        if (!client || !client.documents) return;
        const docToDelete = client.documents[index];
        const updatedDocs = client.documents.filter((_, i) => i !== index);

        try {
            // 1. Delete files from storage (R2 and Cloudinary)
            await apiCall('deleteDocumentFiles', {
                url: docToDelete.url,
                thumbnailUrl: docToDelete.thumbnailUrl
            });

            // 2. Remove from database
            const res = await apiCall('updateClient', { id: client._id, item: { documents: updatedDocs } });
            if (res.success) {
                setClient(res.result);
                success('Document removed from storage and database');
            } else {
                toastError('Failed to remove document reference');
            }
        } catch (err) {
            console.error('Error removing document:', err);
            toastError('Error removing document');
        }
    };

    const handlePreview = (doc: ClientDocument) => {
        setSelectedDoc(doc);
        setIsPreviewModalOpen(true);
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
        <div className="flex flex-col h-full bg-gray-50/50">
            <div className="flex-none bg-white">
            <Header
                leftContent={
                    <button
                        onClick={() => router.push(fromPath || '/clients')}
                        className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title={fromPath ? "Go Back" : "Back to List"}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                }
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleEditClient}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-[#0F4C75] hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit Client"
                        >
                            <Pencil className="w-5 h-5" />
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
            </div>

            <main className="flex-1 overflow-y-auto">
                <div className="w-full px-4 py-4 pb-24 max-w-[1600px] mx-auto">

                    {/* Hero Header Card */}
                    <ClientHeaderCard
                        client={client}
                        onUpdate={() => { }}
                        onAddContact={() => setIsAddContactModalOpen(true)}
                        onAddAddress={() => setIsAddAddressModalOpen(true)}
                        onEditContact={handleEditContact}
                        onRemoveContact={handleRemoveContact}
                        onEditAddress={handleEditAddress}
                        onRemoveAddress={handleRemoveAddress}
                        animate={animate}
                    />


                    {/* Main Layout Grid */}
                    <div className="flex flex-col gap-6">






                        {/* Documents Section */}
                        <div className="mt-4">
                            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-[#3282B8]/10 rounded-2xl">
                                            <FileText className="w-5 h-5 text-[#0F4C75]" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Client Documents</h3>
                                            <p className="text-xs font-medium text-slate-400">Manage and preview client related files</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <DocumentGallery
                                        documents={client.documents || []}
                                        onRemove={handleRemoveDoc}
                                        onPreview={handlePreview}
                                        onUpload={handleBulkUpload}
                                        isUploading={isUploading}
                                    />
                                </div>
                            </div>
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
                title={editingContactIndex !== null ? "Edit Contact" : "Add New Contact"}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsAddContactModalOpen(false)}>Cancel</Button>
                        <Button onClick={editingContactIndex !== null ? handleUpdateContactWithAddressCheck : handleAddContactWithAddressCheck} disabled={!newContact.name}>
                            {editingContactIndex !== null ? "Update Contact" : "Add Contact"}
                        </Button>
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
                        onChange={e => {
                            const formattedValue = formatPhoneNumber(e.target.value);
                            setNewContact({ ...newContact, phone: formattedValue });
                        }}
                        placeholder="(555) 123-4567"
                    />
                    <Input
                        label="Extension"
                        value={newContact.extension}
                        onChange={e => setNewContact({ ...newContact, extension: e.target.value })}
                        placeholder="123"
                    />

                    <SearchableSelect
                        label="Address"
                        value={newContact.address || ''}
                        onChange={val => setNewContact({ ...newContact, address: val })}
                        onAddNew={val => setNewContact({ ...newContact, address: val })}
                        options={Array.from(new Set([
                            ...(client.businessAddress ? [client.businessAddress] : []),
                            ...(client.addresses || [])
                        ].filter(Boolean)))}
                        disableBlank
                        placeholder="Select or type new address..."
                    />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-400 tracking-widest uppercase">Contact Type</label>
                        <select
                            value={newContact.type}
                            onChange={(e) => setNewContact({ ...newContact, type: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#3282B8]/20 focus:border-[#3282B8] transition-all cursor-pointer"
                        >
                            <option value="Main Contact">Main Contact</option>
                            <option value="Accounting">Accounting</option>
                            <option value="Secondary Contact">Secondary Contact</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                        <input
                            type="checkbox"
                            checked={newContact.active}
                            onChange={(e) => setNewContact({ ...newContact, active: e.target.checked })}
                            className="w-5 h-5 rounded text-[#0F4C75] focus:ring-[#3282B8] border-slate-300"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">Set as Primary Active Contact</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Main profile display contact</span>
                        </div>
                    </label>
                </div>
            </Modal>

            {/* Add Address Modal */}
            <Modal
                isOpen={isAddAddressModalOpen}
                onClose={() => setIsAddAddressModalOpen(false)}
                title={editingAddressIndex !== null ? "Edit Address" : "Add New Address"}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsAddAddressModalOpen(false)}>Cancel</Button>
                        <Button onClick={editingAddressIndex !== null ? handleUpdateAddress : handleAddAddress} disabled={!newAddress}>
                            {editingAddressIndex !== null ? "Update Address" : "Add Address"}
                        </Button>
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

            {/* Add Document Modal */}
            <Modal
                isOpen={isAddDocModalOpen}
                onClose={() => setIsAddDocModalOpen(false)}
                title="Upload New Document"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsAddDocModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveDoc} disabled={isUploading || !newDoc.file || !newDoc.name}>
                            {isUploading ? 'Uploading...' : 'Save Document'}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Document Name *"
                        value={newDoc.name}
                        onChange={e => setNewDoc({ ...newDoc, name: e.target.value })}
                        placeholder="e.g. Master Service Agreement"
                    />

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-400 tracking-widest uppercase">Category / Account Type</label>
                        <select
                            value={newDoc.category}
                            onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#3282B8]/20 focus:border-[#3282B8] transition-all cursor-pointer"
                        >
                            <option value="Service Agreement">Service Agreement</option>
                            <option value="Master Service Agreement (MSA)">Master Service Agreement (MSA)</option>
                            <option value="Project Proposal">Project Proposal</option>
                            <option value="Technical Specification">Technical Specification</option>
                            <option value="Permits & Licenses">Permits & Licenses</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-400 tracking-widest uppercase">Select File *</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group relative">
                            <input
                                type="file"
                                onChange={handleDocUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="space-y-2 text-center">
                                <Upload className={`mx-auto h-10 w-10 ${newDoc.file ? 'text-[#0F4C75]' : 'text-slate-400'} group-hover:scale-110 transition-transform`} />
                                <div className="text-sm text-slate-600">
                                    <span className="font-bold text-[#0F4C75] underline">Click to upload</span>
                                    <span> or drag and drop</span>
                                </div>
                                <p className="text-xs text-slate-400">PDF, IMAGE, DOCX up to 10MB</p>
                                {newDoc.name && newDoc.file && (
                                    <div className="mt-2 text-xs font-bold text-[#0F4C75] bg-[#3282B8]/10 px-2 py-1 rounded-full animate-pulse">
                                        File Selected: {newDoc.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Edit Client Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Client Profile"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveClient}>Save Changes</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4 md:gap-8">
                    {/* Top Row: Company Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
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

                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Building className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Notice</p>
                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">To edit individual Contacts or Addresses, please use the edit buttons within their respective sections on the main page.</p>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Document Preview Modal */}
            <DocumentPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                doc={selectedDoc}
            />

        </div>
    );
}
