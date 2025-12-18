'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect, Modal, Input, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface ClientContact {
    _id?: string;
    name: string;
    email?: string;
    phone?: string;
}

interface ContactSelectorProps {
    value?: string; // contactName
    customerId?: string;
    onChange: (name: string, id?: string, email?: string, phone?: string) => void;
}

export function ContactSelector({ value, customerId, onChange }: ContactSelectorProps) {
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(false);

    // New Contact Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newContact, setNewContact] = useState<ClientContact>({ name: '', email: '', phone: '' });

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

                    // Also include primary contact if available
                    if (data.result.contactFullName) {
                        const primaryExists = clientContacts.find((c: any) => c.name === data.result.contactFullName);
                        if (!primaryExists) {
                            clientContacts.unshift({
                                name: data.result.contactFullName,
                                email: data.result.email,
                                phone: data.result.phone
                            });
                        }
                    }

                    setContacts(clientContacts);
                    setOptions(clientContacts.map((c: ClientContact) => c.name));
                }
            } catch (err) {
                console.error('Failed to fetch client contacts', err);
            } finally {
                setLoading(false);
            }
        };

        fetchClientContacts();
    }, [customerId]);

    const handleChange = (newVal: string) => {
        if (!newVal) {
            onChange('', '');
            return;
        }

        const exists = contacts.find((c: ClientContact) => c.name.toLowerCase() === newVal.toLowerCase());
        if (exists) {
            onChange(exists.name, exists._id || exists.name, exists.email, exists.phone);
        } else {

            setNewContact({ name: newVal, email: '', phone: '' });
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
                        value={newContact.email}
                        onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                    />
                    <Input
                        label="Phone"
                        value={newContact.phone}
                        onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                    />
                </div>
            </Modal>
        </div>
    );
}
