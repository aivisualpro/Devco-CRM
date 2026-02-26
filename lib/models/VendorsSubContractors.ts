import mongoose, { Schema, Document, Model } from 'mongoose';

export type VendorSubContractorType = 'Vendor' | 'Sub Contractor';

export interface IContactPerson {
    name: string;
    email?: string;
    phone?: string;
}

export interface IVendorSubContractor extends Document {
    type: VendorSubContractorType;
    name: string;
    address?: string;
    contacts: IContactPerson[];
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ContactPersonSchema = new Schema<IContactPerson>(
    {
        name: { type: String, required: true },
        email: { type: String },
        phone: { type: String },
    },
    { _id: false }
);

const VendorsSubContractorsSchema = new Schema<IVendorSubContractor>(
    {
        type: { type: String, enum: ['Vendor', 'Sub Contractor'], required: true },
        name: { type: String, required: true },
        address: { type: String },
        contacts: { type: [ContactPersonSchema], default: [] },
        createdBy: { type: String },
    },
    { timestamps: true, collection: 'vendorsSubContractors' }
);

const VendorsSubContractors: Model<IVendorSubContractor> =
    mongoose.models.VendorsSubContractors ||
    mongoose.model<IVendorSubContractor>('VendorsSubContractors', VendorsSubContractorsSchema);

export default VendorsSubContractors;
