
import { useState, useEffect } from 'react';
import { Plus, Trash2, User, MapPin } from 'lucide-react';
import { Modal, Button, Input, SearchableSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string;
    active: boolean;
    primary?: boolean;
}

interface ClientAddress {
    address: string;
    primary: boolean;
}

interface Client {
    _id: string; // recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string; // This should be an employee ID/email
    contacts: ClientContact[];
    addresses?: (string | ClientAddress)[];
    documents?: any[];
    status?: string;
}

interface Employee {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    email: string;
}

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Partial<Client>) => Promise<void>;
    initialClient?: Partial<Client>;
    employees: Employee[];
}

const defaultClient: Partial<Client> = {
    name: '',
    businessAddress: '',
    proposalWriter: '',
    contacts: [],
    addresses: [],
    status: 'Active'
};

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

export function ClientModal({ isOpen, onClose, onSave, initialClient, employees }: ClientModalProps) {
    const { error } = useToast();
    const [currentClient, setCurrentClient] = useState<Partial<Client>>(defaultClient);

    useEffect(() => {
        if (isOpen) {
            setCurrentClient(initialClient || { ...defaultClient });
        }
    }, [isOpen, initialClient]);

    const handleSaveInternal = async () => {
        // Validation
        if (!currentClient.name) {
            error('Client Name is required');
            return;
        }

        // Validate Contacts (Mandatory: at least one primary contact)
        const contacts = currentClient.contacts || [];
        const hasPrimaryContact = contacts.some(c => c.primary || c.active);
        
        if (contacts.length === 0) {
             error('At least one contact is required');
             return;
        }

        if (!hasPrimaryContact) {
            error('Please select a primary contact');
            return;
        }

        // Validate Contact Names (Mandatory: Name cannot be empty)
        const hasEmptyContactName = contacts.some(c => !c.name || c.name.trim() === '');
        if (hasEmptyContactName) {
            error('All contacts must have a name');
            return;
        }

        // Validate Addresses (Mandatory: at least one primary address)
        const addresses = currentClient.addresses || [];
        const hasPrimaryAddress = addresses.some(a => {
             if (typeof a === 'string') return true; // strings assumed primary if first? code implies structured objects
             return (a as ClientAddress).primary;
        });

        if (addresses.length === 0) {
            error('At least one address is required');
            return;
        }

        if (!hasPrimaryAddress) {
             // In case of string addresses, the first one is usually treated as primary by the legacy code,
             // but here we should ensure we have explicit primary if possible.
             // The UI forces objects usually.
             const isStringOnly = addresses.every(a => typeof a === 'string');
             if (!isStringOnly) {
                 error('Please select a primary address');
                 return;
             }
        }

        // Validate Addresses (Mandatory: Address cannot be empty)
        const hasEmptyAddress = addresses.some(a => {
            const addr = typeof a === 'string' ? a : a.address;
            return !addr || addr.trim() === '';
        });
        if (hasEmptyAddress) {
            error('All addresses must have content');
            return;
        }

        await onSave(currentClient);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={currentClient._id ? 'Edit Client' : 'New Client'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSaveInternal}>Save Client</Button>
                </>
            }
        >
            <div className="flex flex-col gap-8">
                {/* Top Row: Company Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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
                        <Select
                            value={currentClient.status || 'Active'}
                            onValueChange={(val) => setCurrentClient({ ...currentClient, status: val })}
                        >
                            <SelectTrigger className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#3282B8]/20 focus:border-[#3282B8] transition-all">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Contacts Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-[#0F4C75]" />
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Contacts *</h4>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                const contacts = [...(currentClient.contacts || [])];
                                contacts.push({ name: '', email: '', phone: '', type: contacts.length === 0 ? 'Main Contact' : 'Secondary Contact', active: contacts.length === 0, primary: contacts.length === 0 });
                                setCurrentClient({ ...currentClient, contacts });
                            }}
                            className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider !bg-[#0F4C75]"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> ADD CONTACT
                        </Button>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto pr-2 flex flex-col gap-3 thin-scrollbar">
                        {(currentClient.contacts || []).map((contact, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border transition-all ${contact.active ? 'bg-[#3282B8]/5 border-[#3282B8]/20' : 'bg-slate-50 border-slate-100'} relative group shadow-sm`}>
                                <button
                                    onClick={() => {
                                        const contacts = currentClient.contacts?.filter((_, i) => i !== idx);
                                        setCurrentClient({ ...currentClient, contacts });
                                    }}
                                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4.5 h-4.5" />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-3">
                                        <Input
                                            label="Full Name"
                                            value={contact.name}
                                            onChange={(e) => {
                                                const contacts = [...(currentClient.contacts || [])];
                                                contacts[idx].name = e.target.value;
                                                setCurrentClient({ ...currentClient, contacts });
                                            }}
                                            placeholder="e.g. John Smith"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Input
                                            label="Email"
                                            value={contact.email}
                                            onChange={(e) => {
                                                const contacts = [...(currentClient.contacts || [])];
                                                contacts[idx].email = e.target.value;
                                                setCurrentClient({ ...currentClient, contacts });
                                            }}
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input
                                            label="Phone"
                                            value={contact.phone}
                                            onChange={(e) => {
                                                const formattedValue = formatPhoneNumber(e.target.value);
                                                const contacts = [...(currentClient.contacts || [])];
                                                contacts[idx].phone = formattedValue;
                                                setCurrentClient({ ...currentClient, contacts });
                                            }}
                                            placeholder="(555) 000-0000"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <Input
                                            label="Ext"
                                            value={contact.extension}
                                            onChange={(e) => {
                                                const contacts = [...(currentClient.contacts || [])];
                                                contacts[idx].extension = e.target.value;
                                                setCurrentClient({ ...currentClient, contacts });
                                            }}
                                            placeholder="123"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type & Status</label>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <Select
                                                        value={contact.type}
                                                        onValueChange={(val) => {
                                                            const contacts = [...(currentClient.contacts || [])];
                                                            contacts[idx].type = val;
                                                            setCurrentClient({ ...currentClient, contacts });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#3282B8]/20 transition-all">
                                                            <SelectValue placeholder="Type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Main Contact">Main</SelectItem>
                                                            <SelectItem value="Accounting">Accounting</SelectItem>
                                                            <SelectItem value="Secondary Contact">Secondary</SelectItem>
                                                            <SelectItem value="Other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const contacts = (currentClient.contacts || []).map((c, i) => ({
                                                            ...c,
                                                            active: i === idx,
                                                            primary: i === idx ? true : c.primary
                                                        }));
                                                        setCurrentClient({ ...currentClient, contacts });
                                                    }}
                                                    className={`h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${contact.active ? 'bg-[#0F4C75] text-white border-[#0F4C75]' : 'bg-white text-slate-400 border-slate-200 hover:border-[#3282B8] hover:text-[#3282B8]'}`}
                                                >
                                                    {contact.active ? 'PRIMARY ACTIVE' : 'SET PRIMARY'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {(!currentClient.contacts || currentClient.contacts.length === 0) && (
                            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="text-slate-300 text-sm italic font-medium">No contacts added yet.</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Addresses Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-[#0F4C75]" />
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Addresses *</h4>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                const addresses = [...(currentClient.addresses || [])];
                                addresses.push({ address: '', primary: addresses.length === 0 });
                                setCurrentClient({ ...currentClient, addresses });
                            }}
                            className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider !bg-[#0F4C75]"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> ADD ADDRESS
                        </Button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-3 thin-scrollbar">
                        {(currentClient.addresses || []).map((addrObj, idx) => {
                            const isString = typeof addrObj === 'string';
                            const addr = isString ? addrObj : (addrObj as ClientAddress).address;
                            const isPrimary = isString ? (idx === 0) : (addrObj as ClientAddress).primary;

                            return (
                                <div key={idx} className={`p-4 rounded-2xl border transition-all ${isPrimary ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-100'} relative group flex flex-col md:flex-row gap-4 md:items-end`}>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {isPrimary ? 'Primary Address' : `Additional Address ${idx + 1}`}
                                            </label>
                                            {isPrimary && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">MAIN TABLE ADDRESS</span>}
                                        </div>
                                        <Input
                                            value={addr}
                                            onChange={(e) => {
                                                const addresses = [...(currentClient.addresses || [])];
                                                const newVal = e.target.value;
                                                if (isString) {
                                                    addresses[idx] = newVal;
                                                } else {
                                                    addresses[idx] = { ...(addrObj as ClientAddress), address: newVal };
                                                }
                                                const update: any = { addresses };
                                                if (isPrimary) update.businessAddress = newVal;
                                                setCurrentClient({ ...currentClient, ...update });
                                            }}
                                            placeholder="Enter full address line..."
                                            className="!bg-white"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pb-1">
                                        <button
                                            onClick={() => {
                                                const addresses = (currentClient.addresses || []).map((a, i) => {
                                                    const curAddr = typeof a === 'string' ? a : a.address;
                                                    return { address: curAddr, primary: i === idx };
                                                });
                                                const primaryAddr = addresses.find(a => a.primary);
                                                setCurrentClient({ 
                                                    ...currentClient, 
                                                    addresses,
                                                    businessAddress: primaryAddr?.address || currentClient.businessAddress
                                                });
                                            }}
                                            className={`h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${isPrimary ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-500 hover:text-emerald-500'}`}
                                        >
                                            {isPrimary ? 'PRIMARY' : 'SET PRIMARY'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const addresses = currentClient.addresses?.filter((_, i) => i !== idx);
                                                setCurrentClient({ ...currentClient, addresses });
                                            }}
                                            className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors bg-white border border-slate-200 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {(!currentClient.addresses || currentClient.addresses.length === 0) && (
                            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="text-slate-300 text-sm italic font-medium">No addresses added yet.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
