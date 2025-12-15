import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILaborItem extends Document {
    classification?: string;
    subClassification?: string;
    fringe?: string;
    basePay?: number;
    wCompPercent?: number;
    payrollTaxesPercent?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const LaborItemSchema = new Schema<ILaborItem>({
    classification: { type: String },
    subClassification: { type: String },
    fringe: { type: String },
    basePay: { type: Number, default: 0 },
    wCompPercent: { type: Number, default: 0 },
    payrollTaxesPercent: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'laborItems' });

const LaborItem: Model<ILaborItem> = mongoose.models.LaborItem || mongoose.model<ILaborItem>('LaborItem', LaborItemSchema);

export default LaborItem;

// Estimate Line Items Labor Schema
export interface IEstimateLineItemsLabor extends Document {
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

const EstimateLineItemsLaborSchema = new Schema<IEstimateLineItemsLabor>({
    estimateId: { type: String, required: true, index: true },
    labor: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    fringe: { type: String },
    basePay: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    otPd: { type: Number, default: 0 },
    wCompPercent: { type: Number, default: 0 },
    payrollTaxesPercent: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'estimateLineItemsLabor' });

export const EstimateLineItemsLabor: Model<IEstimateLineItemsLabor> = mongoose.models.EstimateLineItemsLabor || mongoose.model<IEstimateLineItemsLabor>('EstimateLineItemsLabor', EstimateLineItemsLaborSchema);
