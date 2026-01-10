import mongoose, { Schema, Document } from 'mongoose';

export interface IJHASignature extends Document {
    schedule_id: string; // Reference to schedule
    employee: string;
    signature: string; // URL of image
    createdBy: string;
    createdAt?: Date;
    location: string;
}

const JHASignatureSchema: Schema = new Schema({
    _id: { type: String },
    schedule_id: { type: String, required: true },
    employee: { type: String },
    signature: { type: String },
    createdBy: { type: String },
    location: { type: String }
}, {
    timestamps: true
});

// Prevent model overwrite during hot reload
const JHASignature = mongoose.models.JHASignature || mongoose.model<IJHASignature>('JHASignature', JHASignatureSchema);

export default JHASignature;
