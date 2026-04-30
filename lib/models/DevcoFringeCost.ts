import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDevcoFringeCost extends Document {
    type: string;         // 'HDD Private' or 'HDD Public'
    fromDate: Date;
    toDate: Date;
    cost: number;         // Dollar value per hour
    createdAt?: Date;
    updatedAt?: Date;
}

const DevcoFringeCostSchema = new Schema<IDevcoFringeCost>({
    type: { type: String, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    cost: { type: Number, required: true },
}, { timestamps: true, collection: 'DevcoFringeCost' });

DevcoFringeCostSchema.index({ type: 1 });
DevcoFringeCostSchema.index({ fromDate: 1, toDate: 1 });

const DevcoFringeCost: Model<IDevcoFringeCost> = mongoose.models.DevcoFringeCost || mongoose.model<IDevcoFringeCost>('DevcoFringeCost', DevcoFringeCostSchema);

export default DevcoFringeCost;
