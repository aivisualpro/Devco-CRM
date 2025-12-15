import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubcontractorItem extends Document {
    subcontractor?: string;
    classification?: string;
    subClassification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const SubcontractorItemSchema = new Schema<ISubcontractorItem>({
    subcontractor: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'subcontractorItems' });

const SubcontractorItem: Model<ISubcontractorItem> = mongoose.models.SubcontractorItem || mongoose.model<ISubcontractorItem>('SubcontractorItem', SubcontractorItemSchema);

export default SubcontractorItem;

// Estimate Line Items Subcontractor Schema
export interface IEstimateLineItemsSubcontractor extends Document {
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

const EstimateLineItemsSubcontractorSchema = new Schema<IEstimateLineItemsSubcontractor>({
    estimateId: { type: String, required: true, index: true },
    subcontractor: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'estimateLineItemsSubcontractor' });

export const EstimateLineItemsSubcontractor: Model<IEstimateLineItemsSubcontractor> = mongoose.models.EstimateLineItemsSubcontractor || mongoose.model<IEstimateLineItemsSubcontractor>('EstimateLineItemsSubcontractor', EstimateLineItemsSubcontractorSchema);
