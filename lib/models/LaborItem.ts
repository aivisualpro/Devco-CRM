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

