import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMaterialItem extends Document {
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

const MaterialItemSchema = new Schema<IMaterialItem>({
    material: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    supplier: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'materialItems' });

const MaterialItem: Model<IMaterialItem> = mongoose.models.MaterialItem || mongoose.model<IMaterialItem>('MaterialItem', MaterialItemSchema);

export default MaterialItem;

// Estimate Line Items Material Schema
export interface IEstimateLineItemsMaterial extends Document {
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

const EstimateLineItemsMaterialSchema = new Schema<IEstimateLineItemsMaterial>({
    estimateId: { type: String, required: true, index: true },
    material: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    supplier: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'estimateLineItemsMaterial' });

export const EstimateLineItemsMaterial: Model<IEstimateLineItemsMaterial> = mongoose.models.EstimateLineItemsMaterial || mongoose.model<IEstimateLineItemsMaterial>('EstimateLineItemsMaterial', EstimateLineItemsMaterialSchema);
