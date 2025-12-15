'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface CustomerSelectorProps {
    value?: string;
    onChange: (val: string) => void;
}

export function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
    const [clients, setClients] = useState<string[]>([]);
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
                    const names = data.result.map((c: any) => c.name).filter(Boolean).sort();
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
        const exists = clients.some(c => c.toLowerCase() === newVal.toLowerCase());

        if (exists) {
            // Find exact case match if possible
            const exactMatch = clients.find(c => c.toLowerCase() === newVal.toLowerCase()) || newVal;
            onChange(exactMatch);
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
                    setClients(prev => [...prev, newVal].sort());
                    onChange(newVal);
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
