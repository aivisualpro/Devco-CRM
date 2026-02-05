'use client';

import { ChevronDown } from 'lucide-react';
import { MyDropDown } from '@/components/ui/MyDropDown';

interface FilterOption {
    label: string;
    value: string;
    image?: string;
    profilePicture?: string;
    color?: string;
    badge?: string;
}

interface FilterItemProps {
    id: string;
    label: string;
    placeholder: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    openDropdownId: string | null;
    setOpenDropdownId: (id: string | null) => void;
}

export const FilterItem = ({ 
    id, 
    label, 
    placeholder, 
    options, 
    value, 
    onChange, 
    openDropdownId, 
    setOpenDropdownId 
}: FilterItemProps) => (
    <div className="relative">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
        <div 
            id={`anchor-${id}`}
            className="w-full h-10 px-4 py-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer hover:border-[#0F4C75] transition-all shadow-sm group"
            onClick={() => setOpenDropdownId(openDropdownId === id ? null : id)}
        >
            <div className="flex items-center gap-2 truncate flex-1">
                {(() => {
                    const selectedOption = options.find((o) => o.value === value);
                    if (selectedOption?.image || selectedOption?.profilePicture) {
                        return <img src={selectedOption.image || selectedOption.profilePicture} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />;
                    }
                    if (selectedOption?.badge) {
                         return (
                             <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold shadow-sm" style={{ backgroundColor: selectedOption.color || '#fff', color: selectedOption.color ? '#fff' : '#0F4C75', border: selectedOption.color ? 'none' : '1px solid #e2e8f0' }}>
                                 {selectedOption.badge}
                             </div>
                         );
                    }
                    if (selectedOption?.color) {
                        return <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: selectedOption.color }} />;
                    }
                    return null;
                })()}
                <span className={`text-[13px] font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>
                    {options.find((o) => o.value === value)?.label || placeholder}
                </span>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${openDropdownId === id ? 'rotate-180' : ''}`} />
        </div>
        {openDropdownId === id && (
            <MyDropDown
                isOpen={openDropdownId === id}
                onClose={() => setOpenDropdownId(null)}
                options={options.map((o) => ({ 
                    id: o.value, 
                    label: o.label, 
                    value: o.value,
                    profilePicture: o.image || o.profilePicture,
                    color: o.color,
                    badge: o.badge
                }))}
                selectedValues={value ? [value] : []}
                onSelect={(val: string) => {
                    onChange(val === value ? '' : val); // Toggle behavior
                    setOpenDropdownId(null);
                }}
                width="w-[200px]"
                placeholder={`Search...`}
                anchorId={`anchor-${id}`}
            />
        )}
    </div>
);
