import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
    user: string; // Email of user who performed the action
    action: string; // e.g., 'created_jha', 'signed_jha', 'created_schedule', 'updated_estimate'
    type: string; // Category: 'jha', 'schedule', 'estimate', 'client', 'employee'
    title: string; // Human readable description
    entityId?: string; // ID of related entity (schedule id, estimate id, etc.)
    metadata?: Record<string, any>; // Additional data
    createdAt: Date;
}

const ActivitySchema: Schema = new Schema({
    _id: { type: String, required: true },
    user: { type: String, required: true, index: true },
    action: { type: String, required: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    entityId: { type: String },
    metadata: { type: Schema.Types.Mixed }
}, {
    timestamps: true
});

// Compound index for efficient queries
ActivitySchema.index({ user: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: -1 });

const Activity = mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;
