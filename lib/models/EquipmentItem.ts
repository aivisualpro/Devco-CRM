import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEquipmentItem extends Document {
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

const EquipmentItemSchema = new Schema<IEquipmentItem>({
    classification: { type: String },
    subClassification: { type: String },
    equipmentMachine: { type: String },
    uom: { type: String },
    supplier: { type: String },
    dailyCost: { type: Number, default: 0 },
    weeklyCost: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'equipmentItems' });

const EquipmentItem: Model<IEquipmentItem> = mongoose.models.EquipmentItem || mongoose.model<IEquipmentItem>('EquipmentItem', EquipmentItemSchema);

export default EquipmentItem;

// Estimate Line Items Equipment Schema
export interface IEstimateLineItemsEquipment extends Document {
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

const EstimateLineItemsEquipmentSchema = new Schema<IEstimateLineItemsEquipment>({
    estimateId: { type: String, required: true, index: true },
    classification: { type: String },
    subClassification: { type: String },
    equipmentMachine: { type: String },
    uom: { type: String },
    supplier: { type: String },
    dailyCost: { type: Number, default: 0 },
    weeklyCost: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    times: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'estimateLineItemsEquipment' });

export const EstimateLineItemsEquipment: Model<IEstimateLineItemsEquipment> = mongoose.models.EstimateLineItemsEquipment || mongoose.model<IEstimateLineItemsEquipment>('EstimateLineItemsEquipment', EstimateLineItemsEquipmentSchema);
