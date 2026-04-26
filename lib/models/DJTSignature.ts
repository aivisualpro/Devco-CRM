import mongoose, { Schema, Document } from 'mongoose';

export interface IDJTSignature extends Document {
    schedule_id: string;
    employee: string;
    signature: string;
    createdBy?: string;
    signedBy?: string;
    location?: string;
    lunchStart?: string;
    lunchEnd?: string;
    clockOut?: string;
    date?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const DJTSignatureSchema: Schema = new Schema({
    _id: { type: String }, // Using custom string ID for imports
    schedule_id: { type: String, ref: 'Schedule', required: true },
    employee: { type: String, required: true },
    signature: { type: String, required: true },
    createdBy: { type: String },
    signedBy: { type: String },
    location: { type: String, default: '' },
    lunchStart: { type: String },
    lunchEnd: { type: String },
    clockOut: { type: String },
    date: { type: Date },
}, {
    timestamps: true
});

const DJTSignature = mongoose.models.DJTSignature || mongoose.model('DJTSignature', DJTSignatureSchema);

export default DJTSignature;
