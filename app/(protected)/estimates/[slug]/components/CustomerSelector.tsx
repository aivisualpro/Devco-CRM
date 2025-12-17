'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface CustomerSelectorProps {
    value?: string;
    onChange: (val: string, id?: string) => void;
}

interface ClientObj {
    _id: string;
    name: string;
}

export function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
    const [clients, setClients] = useState<string[]>([]);
    const [clientObjs, setClientObjs] = useState<ClientObj[]>([]);
    const { success, error } = useToast();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getClients' })
                });
                const data = await res.json();
                if (data.success) {
                    // Extract names and sort
                    const objs = data.result.map((c: any) => ({ name: c.name, _id: c._id || c.recordId }));
                    setClientObjs(objs);
                    const names = objs.map((c: ClientObj) => c.name).filter(Boolean).sort();
                    setClients(names);
                }
            } catch (err) {
                console.error('Failed to fetch clients', err);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, []);

    const handleChange = async (newVal: string) => {
        if (!newVal) return;

        // Check if existing
        const exists = clientObjs.find(c => c.name.toLowerCase() === newVal.toLowerCase());

        if (exists) {
            // Find exact case match if possible
            onChange(exists.name, exists._id);
        } else {
            // Create new client
            try {
                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'addClient',
                        payload: { item: { name: newVal, status: 'Active' } }
                    })
                });
                const data = await res.json();
                if (data.success) {
                    success('New client added');
                    const newClient = data.result;
                    const newObj = { name: newClient.name, _id: newClient._id || newClient.recordId };

                    setClientObjs(prev => [...prev, newObj]);
                    setClients(prev => [...prev, newVal].sort());

                    onChange(newClient.name, newClient._id || newClient.recordId);
                } else {
                    error('Failed to create client: ' + (data.error || 'Unknown error'));
                }
            } catch (e) {
                error('Error creating client');
                console.error(e);
            }
        }
    };

    if (loading) return <div className="h-10 w-full animate-pulse bg-gray-100 rounded-xl" />;

    return (
        <div className="w-full">
            <SearchableSelect
                value={value || ''}
                onChange={handleChange}
                options={clients}
                placeholder="Select or add customer..."
                className="w-full"
                autoFocus={true}
            />
        </div>
    );
}
