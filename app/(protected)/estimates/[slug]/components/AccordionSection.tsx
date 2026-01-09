import { ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { AddButton } from '@/components/ui';

interface AccordionSectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    itemCount: number;
    sectionTotal: number;
    grandTotal: number;
    color: string;
    onAdd: () => void;
    children: ReactNode;
}

export function AccordionSection({
    title,
    isOpen,
    onToggle,
    itemCount,
    sectionTotal,
    grandTotal,
    color,
    onAdd,
    children
}: AccordionSectionProps) {
    const formatMoney = (n: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(n);

    const percentage = grandTotal > 0 ? (sectionTotal / grandTotal) * 100 : 0;

    return (
        <div className="">
            {/* Header */}
            <div
                className="cursor-pointer group select-none"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-4">
                        <div
                            className={`transition-transform duration-300 text-gray-400 group-hover:text-gray-600 ${isOpen ? 'rotate-180' : ''}`}
                        >
                            <ChevronDown className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            {title}
                            {itemCount > 0 && (
                                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {itemCount}
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdd();
                            }}
                            className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            title={`Add to ${title}`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">

                        <span className="text-sm font-bold text-gray-900 w-32 text-right">
                            {formatMoney(sectionTotal)}
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                            width: `${percentage}%`,
                            opacity: percentage > 0 ? 1 : 0,
                            backgroundColor: color
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] mt-4 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
                <div className="overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm">
                    {children}
                </div>
            </div>
        </div>
    );
}
