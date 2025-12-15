import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClient {
    _id: string; // This will map to recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string;
    contactFullName?: string;
    email?: string;
    phone?: string;
    accountingContact?: string;
    accountingEmail?: string;
    agreementFile?: string;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const ClientSchema: Schema = new Schema({
    _id: { type: String, required: true }, // recordId as _id
    name: { type: String, required: true },
    businessAddress: { type: String },
    proposalWriter: { type: String },
    contactFullName: { type: String },
    email: { type: String },
    phone: { type: String },
    accountingContact: { type: String },
    accountingEmail: { type: String },
    agreementFile: { type: String },
    status: { type: String, default: 'Active' },
}, { timestamps: true });

// Prevent model overwrite in development
const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;
