// TypeScript type definitions for Estimate

export interface Estimate {
    _id: string;
    estimate?: string;
    date?: string;
    customer?: string;
    projectTitle?: string;
    proposalNumber?: string;
    status?: string;
    notes?: string;
    fringe?: string;
    markup?: number;
    confirmed?: boolean;
    oldOrNew?: string;
    proposalWriter?: string;
    certifiedPayroll?: string;


    createdAt?: Date;
    updatedAt?: Date;
    // Line items - populated on fetch
    labor?: LaborLineItem[];
    equipment?: EquipmentLineItem[];
    material?: MaterialLineItem[];
    overhead?: OverheadLineItem[];
    subcontractor?: SubcontractorLineItem[];
    disposal?: DisposalLineItem[];
    miscellaneous?: MiscellaneousLineItem[];
    tools?: ToolLineItem[];
}

export interface LaborLineItem {
    _id?: string;
    estimateId: string;
    labor?: string;
    classification?: string;
    subClassification?: string;
    fringe?: string;
    basePay?: number;
    quantity?: number;
    days?: number;
    otPd?: number;
    wCompPercent?: number;
    payrollTaxesPercent?: number;
    hourlyRate?: number;
    dailyRate?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface EquipmentLineItem {
    _id?: string;
    estimateId: string;
    classification?: string;
    subClassification?: string;
    equipmentMachine?: string;
    uom?: string;
    supplier?: string;
    dailyCost?: number;
    weeklyCost?: number;
    monthlyCost?: number;
    quantity?: number;
    times?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface MaterialLineItem {
    _id?: string;
    estimateId: string;
    material?: string;
    classification?: string;
    subClassification?: string;
    supplier?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    taxes?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface OverheadLineItem {
    _id?: string;
    estimateId: string;
    overhead?: string;
    classification?: string;
    subClassification?: string;
    days?: number;
    hours?: number;
    hourlyRate?: number;
    dailyRate?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface SubcontractorLineItem {
    _id?: string;
    estimateId: string;
    subcontractor?: string;
    classification?: string;
    subClassification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface DisposalLineItem {
    _id?: string;
    estimateId: string;
    disposalAndHaulOff?: string;
    classification?: string;
    subClassification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface MiscellaneousLineItem {
    _id?: string;
    estimateId: string;
    item?: string;
    classification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ToolLineItem {
    _id?: string;
    estimateId: string;
    tool?: string;
    classification?: string;
    subClassification?: string;
    supplier?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    taxes?: number;
    total?: number;
    createdAt?: Date;
    updatedAt?: Date;
}
