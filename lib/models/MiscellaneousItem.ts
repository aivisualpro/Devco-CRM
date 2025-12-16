import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMiscellaneousItem extends Document {
    item?: string;
    classification?: string;
    uom?: string;
    cost?: number;
    quantity?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const MiscellaneousItemSchema = new Schema<IMiscellaneousItem>({
    item: { type: String },
    classification: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'miscellaneousItems' });

const MiscellaneousItem: Model<IMiscellaneousItem> = mongoose.models.MiscellaneousItem || mongoose.model<IMiscellaneousItem>('MiscellaneousItem', MiscellaneousItemSchema);

export default MiscellaneousItem;

