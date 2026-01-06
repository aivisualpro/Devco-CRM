
import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
    title: string;
    subTitle?: string;
    subTitleDescription?: string;
    content: string;
    pages?: {
        content: string;
    }[];
    version: number;
    isCurrent: boolean;
    customVariables?: {
        name: string;
        label: string;
        type: string; // 'text' | 'number' | 'date'
        defaultValue?: string;
    }[];
    status?: string;
    services?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

const TemplateSchema: Schema = new Schema({
    title: { type: String, required: true },
    subTitle: { type: String },
    subTitleDescription: { type: String },
    content: { type: String, default: '' },
    pages: [{
        content: { type: String, default: '' }
    }],
    version: { type: Number, default: 1 },
    isCurrent: { type: Boolean, default: true },
    customVariables: [{
        name: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, default: 'text' },
        defaultValue: { type: String }
    }],
    status: { type: String, default: 'draft' },
    services: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);
