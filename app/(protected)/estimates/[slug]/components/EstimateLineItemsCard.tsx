import { AccordionSection } from './AccordionSection';
import { LineItemsTable } from './LineItemsTable';
import { Copy, FileSpreadsheet, Trash2 } from 'lucide-react';
import React from 'react';

interface EstimateLineItemsCardProps {
    sections: any[];
    openSections: Record<string, boolean>;
    setOpenSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    chartData: any;
    setActiveSection: (section: any) => void;

    onAddItem: (sectionId: string) => void;
    onEditItem: (sectionId: string, item: any, field?: string, value?: string | number) => void;
    onDeleteItem: (sectionId: string, item: any) => void;
    onExplain?: (item: any) => void;
}

export function EstimateLineItemsCard({
    sections,
    openSections,
    setOpenSections,
    chartData,
    setActiveSection,

    onAddItem,
    onEditItem,
    onDeleteItem,
    onExplain
}: EstimateLineItemsCardProps) {
    return (
        <div className="bg-[#eef2f6] rounded-[40px] p-4 flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {sections.map(section => (
                    <AccordionSection
                        key={section.id}
                        title={section.title}
                        isOpen={openSections[section.id] || false}
                        onToggle={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                        itemCount={section.items.length}
                        sectionTotal={section.items.reduce((sum: number, i: any) => sum + (i.total || 0), 0)}
                        grandTotal={chartData.subTotal}
                        color={section.color}
                        onAdd={() => setActiveSection(section)}
                    >
                        <LineItemsTable
                            sectionId={section.id}
                            headers={section.headers}
                            fields={section.fields}
                            editableFields={section.editableFields}
                            items={section.items}
                            onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                            onDelete={(item) => onDeleteItem(section.id, item)}
                            onExplain={section.id === 'Labor' ? onExplain : undefined}
                        />
                    </AccordionSection>
                ))}
            </div>


        </div>
    );
}
