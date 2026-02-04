import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleDocument {
    url: string;
    r2Key?: string;
    fileName: string;
    type?: string;
    uploadedBy?: string;
    uploadedAt: Date;
}

export interface IVehicleDoc extends Document {
    unit: string;
    unitNumber: string;
    vinSerialNumber: string;
    documents: IVehicleDocument[];
    createdAt: Date;
    updatedAt: Date;
}

const VehicleDocSchema = new Schema<IVehicleDoc>({
    unit: { type: String, required: true },
    unitNumber: { type: String, required: true },
    vinSerialNumber: { type: String, required: true },
    documents: [{
        url: { type: String, required: true },
        r2Key: { type: String },
        fileName: { type: String, required: true },
        type: { type: String },
        uploadedBy: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'vehicleDocs' });

const VehicleDoc: Model<IVehicleDoc> = mongoose.models.VehicleDoc || mongoose.model<IVehicleDoc>('VehicleDoc', VehicleDocSchema);

export default VehicleDoc;
