'use client';

import { AddLaborEstimateDialogue } from '@/components/dialogs/AddLaborEstimateDialogue';
import { AddEquipmentEstimateDialogue } from '@/components/dialogs/AddEquipmentEstimateDialogue';
import { AddMaterialEstimateDialogue } from '@/components/dialogs/AddMaterialEstimateDialogue';
import { AddToolsEstimateDialogue } from '@/components/dialogs/AddToolsEstimateDialogue';
import { AddOverheadEstimateDialogue } from '@/components/dialogs/AddOverheadEstimateDialogue';
import { AddSubcontractorEstimateDialogue } from '@/components/dialogs/AddSubcontractorEstimateDialogue';
import { AddDisposalEstimateDialogue } from '@/components/dialogs/AddDisposalEstimateDialogue';
import { AddMiscellaneousEstimateDialogue } from '@/components/dialogs/AddMiscellaneousEstimateDialogue';

interface SectionConfig {
    id: string;
    title: string;
    key: string;
    fields: string[];
    headers: string[];
    formFields?: string[];
    formHeaders?: string[];
    editableFields: string[];
    color: string;
    items: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

interface CatalogItem {
    _id?: string;
    [key: string]: unknown;
}

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    section: SectionConfig | null;
    existingItems: CatalogItem[];
    catalog: CatalogItem[];
    fringe?: string;
    onSave: (section: SectionConfig, data: Record<string, unknown>, isManual: boolean) => Promise<void>;
    fringeConstants?: Array<{ description: string; value: unknown }>;
}

export function AddItemModal(props: AddItemModalProps) {
    if (!props.isOpen || !props.section) return null;

    const commonProps = {
        isOpen: props.isOpen,
        onClose: props.onClose,
        section: props.section,
        existingItems: props.existingItems,
        catalog: props.catalog,
        onSave: props.onSave
    };

    switch (props.section.id) {
        case 'Labor':
            return (
                <AddLaborEstimateDialogue
                    {...commonProps}
                    fringe={props.fringe}
                />
            );
        case 'Equipment':
            return <AddEquipmentEstimateDialogue {...commonProps} />;
        case 'Material':
            return <AddMaterialEstimateDialogue {...commonProps} />;
        case 'Tools':
            return <AddToolsEstimateDialogue {...commonProps} />;
        case 'Overhead':
            return <AddOverheadEstimateDialogue {...commonProps} />;
        case 'Subcontractor':
            return <AddSubcontractorEstimateDialogue {...commonProps} />;
        case 'Disposal':
            return <AddDisposalEstimateDialogue {...commonProps} />;
        case 'Miscellaneous':
            return <AddMiscellaneousEstimateDialogue {...commonProps} />;
        default:
            return null;
    }
}
