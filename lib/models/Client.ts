import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string; // 'Main Contact', 'Accounting', etc.
    active: boolean;
}

export interface IClientDocument {
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: string;
    category?: string;
    uploadedAt?: Date;
}

export interface IClient {
    _id: string; // This will map to recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string;
    contactFullName?: string;
    email?: string;
    phone?: string;
    status?: string;
    contacts?: IClientContact[];
    addresses?: string[];
    documents?: IClientDocument[];
    createdAt?: Date;
    updatedAt?: Date;
}

const ClientDocumentSchema = new Schema({
    name: { type: String },
    url: { type: String },
    thumbnailUrl: { type: String },
    type: { type: String },
    category: { type: String },
    uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const ClientSchema: Schema = new Schema({
    _id: { type: String, required: true }, // recordId as _id
    name: { type: String, required: true },
    businessAddress: { type: String },
    proposalWriter: { type: String },
    contactFullName: { type: String },
    email: { type: String },
    phone: { type: String },
    status: { type: String, default: 'Active' },
    contacts: {
        type: [{
            name: String,
            email: String,
            phone: String,
            extension: String,
            type: { type: String, default: 'Main Contact' },
            active: { type: Boolean, default: false }
        }],
        default: []
    },
    addresses: {
        type: [String],
        default: []
    },
    documents: {
        type: [ClientDocumentSchema],
        default: []
    }
}, { timestamps: true });

// Prevent model overwrite in development, but ensure schema changes are picked up
if (process.env.NODE_ENV === 'development') {
    console.log('[MODEL] Deleting Client model from cache for HMR');
    delete mongoose.models.Client;
}
const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);
console.log('[MODEL] Client model registered/retrieved');

export default Client;
