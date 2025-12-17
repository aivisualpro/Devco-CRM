import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContact {
    _id: string; // recordId
    fullName: string;
    clientName?: string;
    clientId?: string;
    title?: string;
    email?: string;
    phone?: string;
    status?: string;
    isKeyContact?: boolean;
    address?: string; // New field
    createdAt?: Date;
    updatedAt?: Date;
}

const ContactSchema: Schema = new Schema({
    _id: { type: String, required: true }, // recordId as _id
    fullName: { type: String, required: true },
    clientName: { type: String },
    clientId: { type: String },
    title: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String }, // New field
    status: { type: String, default: 'Active' },
    isKeyContact: { type: Boolean, default: false },
}, { timestamps: true });

// Prevent model overwrite in development
const Contact: Model<IContact> = mongoose.models.Contact || mongoose.model<IContact>('Contact', ContactSchema);

export default Contact;
