import mongoose, { Schema, Document } from 'mongoose';

export interface IDJTSignature extends Document {
    schedule_id: string;
    employee: string;
    signature: string;
    createdBy: string;
    location?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const DJTSignatureSchema: Schema = new Schema({
    _id: { type: String }, // Using custom string ID for imports
    schedule_id: { type: String, ref: 'Schedule', required: true },
    employee: { type: String, required: true },
    signature: { type: String, required: true },
    createdBy: { type: String, required: true },
    location: { type: String, default: '' },
}, {
    timestamps: true
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.DJTSignature) {
    delete mongoose.models.DJTSignature;
}
const DJTSignature = mongoose.model<IDJTSignature>('DJTSignature', DJTSignatureSchema);

export default DJTSignature;
