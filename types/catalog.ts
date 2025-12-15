// TypeScript type definitions for Catalog items

export interface EquipmentItem {
    _id?: string;
    classification?: string;
    subClassification?: string;
    equipmentMachine?: string;
    uom?: string;
    supplier?: string;
    dailyCost?: number;
    weeklyCost?: number;
    monthlyCost?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface LaborItem {
    _id?: string;
    classification?: string;
    subClassification?: string;
    fringe?: string;
    basePay?: number;
    wCompPercent?: number;
    payrollTaxesPercent?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface MaterialItem {
    _id?: string;
    material?: string;
    classification?: string;
    subClassification?: string;
    supplier?: string;
    uom?: string;
    cost?: number;
    taxes?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface OverheadItem {
    _id?: string;
    overhead?: string;
    classification?: string;
    subClassification?: string;
    hourlyRate?: number;
    dailyRate?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface SubcontractorItem {
    _id?: string;
    subcontractor?: string;
    classification?: string;
    subClassification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface DisposalItem {
    _id?: string;
    disposalAndHaulOff?: string;
    classification?: string;
    subClassification?: string;
    uom?: string;
    cost?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface MiscellaneousItem {
    _id?: string;
    item?: string;
    classification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ToolItem {
    _id?: string;
    tool?: string;
    classification?: string;
    subClassification?: string;
    supplier?: string;
    uom?: string;
    cost?: number;
    taxes?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export type CatalogItem =
    | EquipmentItem
    | LaborItem
    | MaterialItem
    | OverheadItem
    | SubcontractorItem
    | DisposalItem
    | MiscellaneousItem
    | ToolItem;

export type CatalogType =
    | 'equipment'
    | 'labor'
    | 'material'
    | 'overhead'
    | 'subcontractor'
    | 'disposal'
    | 'miscellaneous'
    | 'tools';
