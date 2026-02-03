import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDevcoCompanyDoc extends Document {
    title: string;
    url: string;
    r2Key?: string;
    thumbnailUrl?: string;
    type?: string;
    uploadedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DevcoCompanyDocSchema = new Schema<IDevcoCompanyDoc>({
    title: { type: String, required: true },
    url: { type: String, required: true },
    r2Key: { type: String },
    thumbnailUrl: { type: String },
    type: { type: String },
    uploadedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'devcoCompanyDocs' });

const DevcoCompanyDoc: Model<IDevcoCompanyDoc> = mongoose.models.DevcoCompanyDoc || mongoose.model<IDevcoCompanyDoc>('DevcoCompanyDoc', DevcoCompanyDocSchema);

export default DevcoCompanyDoc;
