import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui';
import { ContactSelector } from './ContactSelector';

interface EstimateDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: Record<string, any>;
    customerId?: string;
    onUpdate: (field: string, value: string) => void;
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

const FIELD_GROUPS = [
    {
        title: 'Accounting & PO',
        fields: [
            { key: 'accountingContact', label: 'Accounting Contact' },
            { key: 'accountingEmail', label: 'Accounting Email', type: 'email', readOnly: true },
            { key: 'accountingPhone', label: 'Accounting Phone' },
            { key: 'PoORPa', label: 'PO / PA Number' },
            { key: 'poName', label: 'PO Name' },
            { key: 'PoAddress', label: 'PO Address' },
            { key: 'PoPhone', label: 'PO Phone' },
        ]
    },
    {
        title: 'Owner\'s Contact (OC)',
        fields: [
            { key: 'ocName', label: 'Name' },
            { key: 'ocAddress', label: 'Address' },
            { key: 'ocPhone', label: 'Phone' },
        ]
    },
    {
        title: 'Subcontractor (Sub-C)',
        fields: [
            { key: 'subCName', label: 'Name' },
            { key: 'subCAddress', label: 'Address' },
            { key: 'subCPhone', label: 'Phone' },
        ]
    },
    {
        title: 'Lender\'s Inspector (LI)',
        fields: [
            { key: 'liName', label: 'Name' },
            { key: 'liAddress', label: 'Address' },
            { key: 'liPhone', label: 'Phone' },
        ]
    },
    {
        title: 'Special Contact (SC)',
        fields: [
            { key: 'scName', label: 'Name' },
            { key: 'scAddress', label: 'Address' },
            { key: 'scPhone', label: 'Phone' },
        ]
    },
    {
        title: 'Project Info',
        fields: [
            { key: 'bondNumber', label: 'Bond Number' },
            { key: 'projectId', label: 'Project ID' },
            { key: 'fbName', label: 'FB Name' },
            { key: 'fbAddress', label: 'FB Address' },
            { key: 'eCPRSystem', label: 'eCPR System' },
        ]
    },
    {
        title: 'Service & Utilities',
        fields: [
            { key: 'typeOfServiceRequired', label: 'Type of Service Required' },
            { key: 'wetUtilities', label: 'Wet Utilities' },
            { key: 'dryUtilities', label: 'Dry Utilities' },
        ]
    },
    {
        title: 'Dates & Conditions',
        fields: [
            { key: 'estimatedStartDate', label: 'Est. Start Date', type: 'date' },
            { key: 'estimatedCompletionDate', label: 'Est. Completion Date', type: 'date' },
            { key: 'siteConditions', label: 'Site Conditions', type: 'textarea' },
            { key: 'projectDescription', label: 'Project Description', type: 'textarea' },
        ]
    },
    {
        title: 'Financial Terms',
        fields: [
            { key: 'prelimAmount', label: 'Prelim Amount' },
            { key: 'billingTerms', label: 'Billing Terms' },
            { key: 'otherBillingTerms', label: 'Other Billing Terms' },
        ]
    }
];

export function EstimateDetailsModal({ isOpen, onClose, formData, customerId, onUpdate }: EstimateDetailsModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-7xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Estimate Details</h2>
                        <p className="text-slate-500 text-sm">Additional project information and contacts</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
                        {FIELD_GROUPS.map((group, idx) => (
                            <div key={idx} className={`space-y-4 ${group.title === 'Project Info' || group.title === 'Dates & Conditions' ? 'lg:col-span-2' : ''}`}>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                                    {group.title}
                                </h3>
                                <div className="space-y-4">
                                    {group.fields.map((field: any) => (
                                        <div key={field.key}>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                                                {field.label}
                                            </label>

                                            {field.key === 'accountingContact' ? (
                                                <ContactSelector
                                                    value={formData.accountingContact}
                                                    customerId={customerId}
                                                    filterType="Accounting"
                                                    onChange={(name: string, id?: string, email?: string, phone?: string) => {
                                                        onUpdate('accountingContact', name);
                                                        // Only update email if provided, it's read-only for user but updated by selector
                                                        if (email) onUpdate('accountingEmail', email);
                                                        if (phone) onUpdate('accountingPhone', phone);
                                                    }}
                                                />
                                            ) : field.type === 'textarea' ? (
                                                <textarea
                                                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none h-24 ${field.readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    value={formData[field.key] || ''}
                                                    onChange={(e) => onUpdate(field.key, e.target.value)}
                                                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                    readOnly={field.readOnly}
                                                />
                                            ) : (
                                                <input
                                                    type={field.type || 'text'}
                                                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none ${field.readOnly ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                                                    value={formData[field.key] || ''}
                                                    onChange={(e) => {
                                                        if (field.readOnly) return;
                                                        const val = e.target.value;
                                                        // Auto-format phone numbers
                                                        if (field.key.toLowerCase().includes('phone')) {
                                                            onUpdate(field.key, formatPhoneNumber(val));
                                                        } else {
                                                            onUpdate(field.key, val);
                                                        }
                                                    }}
                                                    placeholder={field.readOnly ? 'Auto-populated' : `Enter ${field.label.toLowerCase()}...`}
                                                    readOnly={field.readOnly}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <Button onClick={onClose} size="lg" className="px-8">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
