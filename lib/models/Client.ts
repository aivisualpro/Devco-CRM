import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClientContact {
    name: string;
    email?: string;
    phone?: string;
}

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
    contacts?: IClientContact[];
    addresses?: string[];
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
    contacts: {
        type: [{
            name: String,
            email: String,
            phone: String
        }],
        default: []
    },
    addresses: {
        type: [String],
        default: []
    }
}, { timestamps: true });

// Prevent model overwrite in development, but ensure schema changes are picked up
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Client;
}
const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;
