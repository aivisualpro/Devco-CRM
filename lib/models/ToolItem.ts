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

