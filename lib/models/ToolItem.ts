import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IToolItem extends Document {
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

const ToolItemSchema = new Schema<IToolItem>({
    tool: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    supplier: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'toolItems' });

const ToolItem: Model<IToolItem> = mongoose.models.ToolItem || mongoose.model<IToolItem>('ToolItem', ToolItemSchema);

export default ToolItem;

// Estimate Line Items Tools Schema
export interface IEstimateLineItemsTools extends Document {
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

const EstimateLineItemsToolsSchema = new Schema<IEstimateLineItemsTools>({
    estimateId: { type: String, required: true, index: true },
    tool: { type: String },
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
}, { timestamps: true, collection: 'estimateLineItemsTools' });

export const EstimateLineItemsTools: Model<IEstimateLineItemsTools> = mongoose.models.EstimateLineItemsTools || mongoose.model<IEstimateLineItemsTools>('EstimateLineItemsTools', EstimateLineItemsToolsSchema);
