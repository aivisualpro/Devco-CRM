import { AccordionSection } from './AccordionSection';
import { LaborLineItemsTable } from './LaborLineItemsTable';
import { EquipmentLineItemsTable } from './EquipmentLineItemsTable';
import { MaterialLineItemsTable } from './MaterialLineItemsTable';
import { ToolsLineItemsTable } from './ToolsLineItemsTable';
import { OverheadLineItemsTable } from './OverheadLineItemsTable';
import { SubcontractorLineItemsTable } from './SubcontractorLineItemsTable';
import { DisposalLineItemsTable } from './DisposalLineItemsTable';
import { MiscellaneousLineItemsTable } from './MiscellaneousLineItemsTable';
import { Copy, FileSpreadsheet, Trash2 } from 'lucide-react';
import React from 'react';
import { type FringeConstant } from '@/lib/estimateCalculations';

interface EstimateLineItemsCardProps {
    sections: any[];
    openSections: Record<string, boolean>;
    setOpenSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    chartData: any;
    setActiveSection: (section: any) => void;

    onAddItem: (sectionId: string) => void;
    onEditItem: (sectionId: string, item: any, field?: string, value?: string | number) => void;
    onDeleteItem: (sectionId: string, item: any) => void;
    onDuplicateItem: (sectionId: string, item: any) => void;
    onExplain?: (item: any) => void;
    fringeRate?: number;
    fringeConstants?: FringeConstant[];
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
    onDuplicateItem,
    onExplain,
    fringeRate = 0,
    fringeConstants = []
}: EstimateLineItemsCardProps) {
    return (
        <div className="bg-[#eef2f6] rounded-2xl lg:rounded-[40px] p-2 lg:p-4 flex flex-col h-full relative">
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
                        {section.id === 'Labor' ? (
                            <LaborLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                                onExplain={onExplain}
                                fringeRate={fringeRate}
                                fringeConstants={fringeConstants}
                            />
                        ) : section.id === 'Equipment' ? (
                            <EquipmentLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : section.id === 'Material' ? (
                            <MaterialLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : section.id === 'Tools' ? (
                            <ToolsLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : section.id === 'Overhead' ? (
                            <OverheadLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : section.id === 'Subcontractor' ? (
                            <SubcontractorLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : section.id === 'Disposal' ? (
                            <DisposalLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : section.id === 'Miscellaneous' ? (
                            <MiscellaneousLineItemsTable
                                items={section.items}
                                onUpdateItem={(item, field, value) => onEditItem(section.id, item, field, value)}
                                onDelete={(item: any) => onDeleteItem(section.id, item)}
                                onDuplicate={(item: any) => onDuplicateItem(section.id, item)}
                            />
                        ) : (
                            <div className="p-8 text-center text-red-500 text-sm">
                                Unknown section type: {section.id}
                            </div>
                        )}
                    </AccordionSection>
                ))}
            </div>


        </div>
    );
}
