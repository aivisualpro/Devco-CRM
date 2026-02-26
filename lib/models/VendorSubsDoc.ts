import mongoose, { Schema, Document, Model } from 'mongoose';

export const VENDOR_SUBS_DOC_TYPES = [
    'COI',
    'W9',
    'Prelim',
    'Conditional Release on Progress Payment',
    'Conditional Release on Final Payment',
    'Unconditional Release on Progress Payment',
    'Unconditional Release on Final Payment',
    'CPR',
    'Other',
] as const;

export type VendorSubsDocType = typeof VENDOR_SUBS_DOC_TYPES[number];

export interface IVendorSubsFile {
    url: string;
    r2Key?: string;
    thumbnailUrl?: string;
    fileName: string;
    fileType?: string;
    uploadedBy?: string;
    uploadedAt: Date;
}

export interface IVendorSubsDoc extends Document {
    estimate: string;          // estimate number e.g. "26-0002"
    type: VendorSubsDocType;
    vendorSubName: string;
    fileName: string;
    files: IVendorSubsFile[];
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const VendorSubsFileSchema = new Schema<IVendorSubsFile>({
    url: { type: String, required: true },
    r2Key: { type: String },
    thumbnailUrl: { type: String },
    fileName: { type: String, required: true },
    fileType: { type: String },
    uploadedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now },
});

const VendorSubsDocSchema = new Schema<IVendorSubsDoc>(
    {
        estimate: { type: String, required: true, index: true },
        type: { type: String, required: true },
        vendorSubName: { type: String, required: true },
        fileName: { type: String, required: true },
        files: [VendorSubsFileSchema],
        createdBy: { type: String },
    },
    { timestamps: true, collection: 'vendorSubsDocs' }
);

const VendorSubsDoc: Model<IVendorSubsDoc> =
    mongoose.models.VendorSubsDoc ||
    mongoose.model<IVendorSubsDoc>('VendorSubsDoc', VendorSubsDocSchema);

export default VendorSubsDoc;
