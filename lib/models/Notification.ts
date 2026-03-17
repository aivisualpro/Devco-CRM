import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification {
    _id?: string;
    recipientEmail: string;         // The user who should see this notification
    type: string;                   // 'schedule_assigned', 'schedule_updated', 'estimate_won', etc.
    title: string;                  // Short title
    message: string;                // Descriptive message
    link?: string;                  // URL to navigate to
    read: boolean;                  // Has the user read it?
    readAt?: Date;
    metadata?: Record<string, any>; // Extra data (scheduleId, estimateId, etc.)
    createdBy?: string;             // Who triggered this notification
    createdAt?: Date;
    updatedAt?: Date;
}

const NotificationSchema: Schema = new Schema({
    recipientEmail: { type: String, required: true, index: true },
    type: { type: String, required: true, default: 'general' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String },
}, { timestamps: true });

// Compound index for fast queries: unread notifications for a user, sorted by date
NotificationSchema.index({ recipientEmail: 1, read: 1, createdAt: -1 });

// TTL index: auto-delete notifications older than 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Prevent model overwrite in development
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Notification;
}

const Notification: Model<INotification & Document> = mongoose.models.Notification || mongoose.model<INotification & Document>('Notification', NotificationSchema);

export default Notification;
