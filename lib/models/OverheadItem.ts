import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOverheadItem extends Document {
    overhead?: string;
    classification?: string;
    subClassification?: string;
    hourlyRate?: number;
    dailyRate?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const OverheadItemSchema = new Schema<IOverheadItem>({
    overhead: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    hourlyRate: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'overheadItems' });

const OverheadItem: Model<IOverheadItem> = mongoose.models.OverheadItem || mongoose.model<IOverheadItem>('OverheadItem', OverheadItemSchema);

export default OverheadItem;

