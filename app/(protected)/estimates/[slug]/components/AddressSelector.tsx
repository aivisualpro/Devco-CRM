'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface AddressSelectorProps {
    value?: string;
    customerId?: string;
    onChange: (val: string) => void;
}

export function AddressSelector({ value, customerId, onChange }: AddressSelectorProps) {
    const [options, setOptions] = useState<string[]>([]);
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!customerId) {
            setOptions([]);
            return;
        }

        const fetchClientAddresses = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getClientById', payload: { id: customerId } })
                });
                const data = await res.json();
                if (data.success && data.result) {
                    const addresses = data.result.addresses || [];
                    // Add primary businessAddress if not in list
                    if (data.result.businessAddress && !addresses.includes(data.result.businessAddress)) {
                        addresses.unshift(data.result.businessAddress);
                    }
                    setOptions(addresses);
                }
            } catch (err) {
                console.error('Failed to fetch client addresses', err);
            } finally {
                setLoading(false);
            }
        };

        fetchClientAddresses();
    }, [customerId]);

    const handleChange = async (newVal: string) => {
        if (!newVal) {
            onChange('');
            return;
        }

        const exists = options.includes(newVal);

        if (exists) {
            onChange(newVal);
        } else {
            // Add new address to client
            if (!customerId) {
                onChange(newVal);
                return;
            }

            try {
                const updatedAddresses = [...options, newVal];
                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateClient',
                        payload: { id: customerId, item: { addresses: updatedAddresses } }
                    })
                });
                const data = await res.json();
                if (data.success) {
                    success('New address added to client');
                    setOptions(updatedAddresses);
                    onChange(newVal);
                } else {
                    toastError('Failed to add address to client');
                    onChange(newVal); // Still allow selection
                }
            } catch (e) {
                console.error(e);
                toastError('Error updating client addresses');
                onChange(newVal);
            }
        }
    };

    if (loading) return <div className="h-10 w-full animate-pulse bg-gray-100 rounded-xl" />;

    return (
        <div className="w-full">
            <SearchableSelect
                value={value || ''}
                onChange={handleChange}
                options={options}
                placeholder="Select or add job address..."
                className="w-full"
                autoFocus={false}
            />
        </div>
    );
}
