'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect, Modal, Button, Input } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface ContactSelectorProps {
    value?: string;
    customerId?: string;
    onChange: (val: string, id?: string, address?: string) => void;
}

interface ContactObj {
    _id: string;
    fullName: string;
    isKeyContact: boolean;
    email?: string;
    phone?: string;
    address?: string; // Added field
}

export function ContactSelector({ value, customerId, onChange }: ContactSelectorProps) {
    const [contacts, setContacts] = useState<ContactObj[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const { success, error } = useToast();
    const [loading, setLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // New Contact Form State
    const [newContactName, setNewContactName] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');
    const [newContactAddress, setNewContactAddress] = useState('');

    useEffect(() => {
        if (!customerId) {
            setContacts([]);
            setOptions([]);
            return;
        }

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
                    // Filter by customerId
                    const relevantContacts = data.result.filter((c: any) => c.clientId === customerId);
                    const mapped = relevantContacts.map((c: any) => ({
                        _id: c._id || c.recordId,
                        fullName: c.fullName,
                        isKeyContact: !!c.isKeyContact,
                        email: c.email,
                        phone: c.phone,
                        address: c.address // Map address
                    }));
                    setContacts(mapped);
                    setOptions(mapped.map((c: ContactObj) => c.fullName).sort());
                }
            } catch (err) {
                console.error('Failed to fetch contacts', err);
            } finally {
                setLoading(false);
            }
        };

        fetchContacts();
    }, [customerId]);

    const handleChange = (newVal: string) => {
        const contact = contacts.find(c => c.fullName.toLowerCase() === newVal.toLowerCase());
        if (contact) {
            onChange(contact.fullName, contact._id, contact.address);
        } else {
            // If strictly selecting from list, we might want to prevent custom text or treat as new
            // For now, treat as just text if not found, or trigger add
            onChange(newVal);
        }
    };

    const handleAddNew = (val: string) => {
        setNewContactName(val);
        setIsAddModalOpen(true);
    };

    const submitNewContact = async () => {
        if (!customerId) {
            error('No customer selected');
            return;
        }
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addContact',
                    payload: {
                        item: {
                            fullName: newContactName,
                            email: newContactEmail,
                            phone: newContactPhone,
                            address: newContactAddress,
                            clientId: customerId,
                            status: 'Active'
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                success('Contact added');
                const newContact = data.result;
                const newObj: ContactObj = {
                    _id: newContact._id,
                    fullName: newContact.fullName,
                    isKeyContact: false, // Default false for manually added via this flow? or logic handles it
                    email: newContact.email,
                    phone: newContact.phone,
                    address: newContact.address
                };
                setContacts(prev => [...prev, newObj]);
                setOptions(prev => [...prev, newObj.fullName].sort());
                onChange(newObj.fullName, newObj._id, newObj.address);
                setIsAddModalOpen(false);
                // Reset form
                setNewContactName('');
                setNewContactEmail('');
                setNewContactPhone('');
                setNewContactAddress('');
            } else {
                error('Failed to add contact');
            }
        } catch (e) {
            console.error(e);
            error('Error adding contact');
        }
    };

    if (loading) return <div className="h-10 w-full animate-pulse bg-gray-100 rounded-xl" />;

    return (
        <div className="w-full">
            <SearchableSelect
                value={value || ''}
                onChange={handleChange}
                onAddNew={handleAddNew}
                options={options}
                placeholder={customerId ? "Select contact..." : "Select customer first"}
                className="w-full"
                autoFocus={true}
            />

            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Contact"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                        <Button onClick={submitNewContact} disabled={!newContactName}>Save Contact</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Full Name"
                        value={newContactName}
                        onChange={e => setNewContactName(e.target.value)}
                        placeholder="John Doe"
                    />
                    <Input
                        label="Email"
                        value={newContactEmail}
                        onChange={e => setNewContactEmail(e.target.value)}
                        placeholder="john@example.com"
                    />
                    <Input
                        label="Phone"
                        value={newContactPhone}
                        onChange={e => setNewContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                    <Input
                        label="Address"
                        value={newContactAddress}
                        onChange={e => setNewContactAddress(e.target.value)}
                        placeholder="123 Main St"
                    />
                </div>
            </Modal>
        </div>
    );
}
