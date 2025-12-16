import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGlobalCustomVariable extends Document {
    name: string;
    label: string;
    type: string; // 'text' | 'number' | 'date'
    defaultValue?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const GlobalCustomVariableSchema = new Schema<IGlobalCustomVariable>({
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    type: { type: String, default: 'text' },
    defaultValue: { type: String },
}, { timestamps: true, collection: 'globalCustomVariables' });

const GlobalCustomVariable: Model<IGlobalCustomVariable> = mongoose.models.GlobalCustomVariable || mongoose.model<IGlobalCustomVariable>('GlobalCustomVariable', GlobalCustomVariableSchema);

export default GlobalCustomVariable;
