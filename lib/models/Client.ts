import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string; // 'Main Contact', 'Accounting', etc.
    active: boolean;
    primary?: boolean;
}

export interface IClientAddress {
    address: string;
    primary: boolean;
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
    addresses?: (string | IClientAddress)[];
    documents?: IClientDocument[];
    createdAt?: Date;
    updatedAt?: Date;
    primaryContact?: any;
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
            active: { type: Boolean, default: false },
            primary: { type: Boolean, default: false }
        }],
        default: []
    },
    addresses: {
        type: [Schema.Types.Mixed], // Using Mixed to allow for migration from String to Object
        default: []
    },
    documents: {
        type: [ClientDocumentSchema],
        default: []
    }
}, { timestamps: true });

ClientSchema.virtual('primaryContact').get(function(this: any) {
    if (this.contacts && this.contacts.length > 0) {
        return this.contacts.find((c: any) => c.primary) || this.contacts.find((c: any) => c.active) || this.contacts[0];
    }
    return null;
});
ClientSchema.set('toJSON', { virtuals: true });
ClientSchema.set('toObject', { virtuals: true });

ClientSchema.index({ name: 1 });
ClientSchema.index({ 'contacts.0.email': 1 });
ClientSchema.index({ createdAt: -1 });
ClientSchema.index({ name: 'text', 'contacts.email': 'text', 'contacts.name': 'text' });

// Prevent model overwrite in development, but ensure schema changes are picked up
if (process.env.NODE_ENV === 'development') {
    console.log('[MODEL] Deleting Client model from cache for HMR');
    delete mongoose.models.Client;
}
const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);
if (process.env.NODE_ENV !== 'production') console.log('[MODEL] Client model registered/retrieved');

export default Client;
