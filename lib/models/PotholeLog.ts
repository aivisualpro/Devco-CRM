import mongoose, { Schema, Document } from 'mongoose';

export interface IPotholeItem {
    _id?: string;
    potholeNo: string;
    typeOfUtility: string;
    soilType: string;
    topDepthOfUtility: string;
    bottomDepthOfUtility: string;
    photo1?: string;
    photo2?: string;
    pin?: string;
    createdBy: string;
    createdAt: Date;
}

export interface IPotholeLog extends Document {
    oldrefid?: string;
    date: Date;
    estimate: string;
    projectionLocation?: string;
    locationOfPothole?: {
        lat: number;
        lng: number;
    };
    potholeItems: IPotholeItem[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const PotholeItemSchema = new Schema({
    _id: { type: String },
    potholeNo: { type: String, default: '' },
    typeOfUtility: { type: String, default: '' },
    soilType: { type: String, default: '' },
    topDepthOfUtility: { type: String, default: '' },
    bottomDepthOfUtility: { type: String, default: '' },
    photo1: { type: String, default: '' },
    photo2: { type: String, default: '' },
    pin: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const PotholeLogSchema: Schema = new Schema({
    _id: { type: String },
    oldrefid: { type: String, default: '' },
    date: { type: Date, required: true },
    estimate: { type: String, ref: 'Estimate', required: true },
    projectionLocation: { type: String, default: '' },
    locationOfPothole: {
        lat: { type: Number },
        lng: { type: Number }
    },
    potholeItems: [PotholeItemSchema],
    createdBy: { type: String, required: true }
}, {
    timestamps: true
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.PotholeLog) {
    delete mongoose.models.PotholeLog;
}

const PotholeLog = mongoose.model<IPotholeLog>('PotholeLog', PotholeLogSchema);

export default PotholeLog;
