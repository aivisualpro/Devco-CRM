import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookLog extends Document {
    source: string;
    payload: any;
    headers: Record<string, string>;
    status: 'received' | 'processed' | 'failed';
    error?: string;
    entitiesProcessed: number;
    projectsSynced: string[];
    receivedAt: Date;
    processedAt?: Date;
}

const WebhookLogSchema = new Schema({
    source: { type: String, default: 'quickbooks' },
    payload: { type: Schema.Types.Mixed },
    headers: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['received', 'processed', 'failed'], default: 'received' },
    error: { type: String },
    entitiesProcessed: { type: Number, default: 0 },
    projectsSynced: [{ type: String }],
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
}, { timestamps: true });

// Auto-cleanup: remove logs older than 30 days
WebhookLogSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.models.WebhookLog || mongoose.model<IWebhookLog>('WebhookLog', WebhookLogSchema);
