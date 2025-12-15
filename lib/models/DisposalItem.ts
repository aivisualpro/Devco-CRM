import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDisposalItem extends Document {
    disposalAndHaulOff?: string;
    classification?: string;
    subClassification?: string;
    uom?: string;
    cost?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const DisposalItemSchema = new Schema<IDisposalItem>({
    disposalAndHaulOff: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'disposalItems' });

const DisposalItem: Model<IDisposalItem> = mongoose.models.DisposalItem || mongoose.model<IDisposalItem>('DisposalItem', DisposalItemSchema);

export default DisposalItem;

// Estimate Line Items Disposal Schema
export interface IEstimateLineItemsDisposal extends Document {
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

const EstimateLineItemsDisposalSchema = new Schema<IEstimateLineItemsDisposal>({
    estimateId: { type: String, required: true, index: true },
    disposalAndHaulOff: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'estimateLineItemsDisposal' });

export const EstimateLineItemsDisposal: Model<IEstimateLineItemsDisposal> = mongoose.models.EstimateLineItemsDisposal || mongoose.model<IEstimateLineItemsDisposal>('EstimateLineItemsDisposal', EstimateLineItemsDisposalSchema);
