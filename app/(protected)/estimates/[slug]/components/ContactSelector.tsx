'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect, Modal, Input, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface ClientContact {
    _id?: string;
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type?: string;
}

interface ContactSelectorProps {
    value?: string; // contactName
    customerId?: string;
    filterType?: string;
    onChange: (name: string, id?: string, email?: string, phone?: string) => void;
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

export function ContactSelector({ value, customerId, filterType, onChange }: ContactSelectorProps) {
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(false);

    // New Contact Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newContact, setNewContact] = useState<ClientContact>({
        name: '',
        email: '',
        phone: '',
        type: filterType || 'Main Contact'
    });

    useEffect(() => {
        if (!customerId) {
            setContacts([]);
            setOptions([]);
            return;
        }

        const fetchClientContacts = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getClientById', payload: { id: customerId } })
                });
                const data = await res.json();
                if (data.success && data.result) {
                    const clientContacts = data.result.contacts || [];

                    // Also include primary contact if available, defaulting type to Main Contact if missing
                    if (data.result.contactFullName) {
                        const primaryExists = clientContacts.find((c: any) => c.name === data.result.contactFullName);
                        if (!primaryExists) {
                            clientContacts.unshift({
                                name: data.result.contactFullName,
                                email: data.result.email,
                                phone: data.result.phone,
                                type: 'Main Contact'
                            });
                        }
                    }

                    setContacts(clientContacts);

                    // Filter options based on filterType
                    let filtered = clientContacts;
                    if (filterType) {
                        filtered = clientContacts.filter((c: ClientContact) =>
                            c.type?.toLowerCase() === filterType.toLowerCase()
                        );
                    }
                    setOptions(filtered.map((c: ClientContact) => c.name));
                }
            } catch (err) {
                console.error('Failed to fetch client contacts', err);
            } finally {
                setLoading(false);
            }
        };

        fetchClientContacts();
    }, [customerId, filterType]);

    const handleChange = (newVal: string) => {
        if (!newVal) {
            onChange('', '');
            return;
        }

        // Search in ALL contacts to find match, validation is handled by UI filtering usually but strict check here is good
        // However, if we filter options, user can likely only select from valid ones or add new.
        // If adding new, we apply filterType as default type.

        const exists = contacts.find((c: ClientContact) => c.name.toLowerCase() === newVal.toLowerCase());

        // If it exists but doesn't match filter type, what do we do? 
        // Usage choice: we should allow selecting it if the user typed it exactly? 
        // Or assume they want to create a new one for THIS type?
        // Let's assume standard select behavior: if found in filtered list, select it.

        if (exists) {
            onChange(exists.name, exists._id || exists.name, exists.email, exists.phone);
        } else {
            setNewContact({
                name: newVal,
                email: '',
                phone: '',
                type: filterType || 'Main Contact'
            });
            setIsModalOpen(true);
        }
    };

    const handleSaveNewContact = async () => {
        if (!customerId || !newContact.name) return;

        try {
            const updatedContacts = [...contacts, newContact];
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateClient',
                    payload: { id: customerId, item: { contacts: updatedContacts } }
                })
            });
            const data = await res.json();
            if (data.success) {
                success('New contact added to client');
                setContacts(updatedContacts);
                setOptions(updatedContacts.map(c => c.name));
                onChange(newContact.name, newContact.name, newContact.email, newContact.phone);
                setIsModalOpen(false);

            } else {
                toastError('Failed to add contact');
            }
        } catch (e) {
            console.error(e);
            toastError('Error updating client contacts');
        }
    };

    if (loading) return <div className="h-10 w-full animate-pulse bg-gray-100 rounded-xl" />;

    return (
        <div className="w-full">
            <SearchableSelect
                value={value || ''}
                onChange={handleChange}
                onAddNew={handleChange}
                options={options}
                placeholder="Select or add contact..."
                className="w-full"
                autoFocus={false}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Contact to Client"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveNewContact}>Save Contact</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Full Name"
                        value={newContact.name}
                        onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                    />
                    <Input
                        label="Email"
                        value={newContact.email || ''}
                        onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                    />
                    <Input
                        label="Phone"
                        value={newContact.phone || ''}
                        onChange={e => {
                            const formattedValue = formatPhoneNumber(e.target.value);
                            setNewContact({ ...newContact, phone: formattedValue });
                        }}
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                        <select
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={newContact.type}
                            onChange={e => setNewContact({ ...newContact, type: e.target.value })}
                        >
                            <option value="Main Contact">Main Contact</option>
                            <option value="Accounting">Accounting</option>
                            <option value="Billing">Billing</option>
                            <option value="Site Contact">Site Contact</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <Input
                        label="Extension"
                        value={newContact.extension || ''}
                        onChange={e => setNewContact({ ...newContact, extension: e.target.value })}
                        placeholder="123"
                    />
                </div>
            </Modal>
        </div>
    );
}
