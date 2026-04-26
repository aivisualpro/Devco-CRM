import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInspectionItem {
    name: string;
    status: 'ok' | 'needs_attention' | '';
    notes: string;
}

export interface IEquipmentInspection extends Document {
    date: Date;
    type: string;
    inspectionFrequency: string;
    estimate: string;
    projectName: string;
    jobLocation: string;
    equipment: string;
    inspectionItems: IInspectionItem[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const InspectionItemSchema = new Schema({
    name: { type: String, required: true },
    status: { type: String, enum: ['ok', 'needs_attention', ''], default: '' },
    notes: { type: String, default: '' }
}, { _id: false });

const EquipmentInspectionSchema = new Schema<IEquipmentInspection>({
    date: { type: Date, required: true },
    type: { type: String, required: true },
    inspectionFrequency: { type: String, required: true },
    estimate: { type: String, default: '' },
    projectName: { type: String, default: '' },
    jobLocation: { type: String, default: '' },
    equipment: { type: String, default: '' },
    inspectionItems: { type: [InspectionItemSchema], default: [] },
    createdBy: { type: String, required: true }
}, {
    timestamps: true,
    collection: 'DevcoEquipmentInspectionChecklist'
});

if (mongoose.models.EquipmentInspection) {
    if (process.env.NODE_ENV === 'development') {
        delete mongoose.models.EquipmentInspection;
    }
}

const EquipmentInspection: Model<IEquipmentInspection> = mongoose.model<IEquipmentInspection>('EquipmentInspection', EquipmentInspectionSchema);

export default EquipmentInspection;
