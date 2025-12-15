import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConstant extends Document {
    category?: string;
    description?: string;
    value?: string;
    color?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const ConstantSchema = new Schema<IConstant>({
    category: { type: String },
    description: { type: String },
    value: { type: String },
    color: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'constantItems' });

const Constant: Model<IConstant> = mongoose.models.Constant || mongoose.model<IConstant>('Constant', ConstantSchema);

export default Constant;
