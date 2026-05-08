import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFollowup extends Document {
  estimateNumber: string;        // proposalNumber, e.g. "26-0382"
  estimateId?: string;           // Estimate._id
  customerId?: string;
  customerName?: string;

  followupDate: string;          // wall-clock ISO (matches your design contract)
  nextFollowupDate?: string;     // optional next; if absent → status auto-completed

  remarks: string;
  suggestedAction?: string;      // optional AI-style suggestion
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  channel?: 'phone' | 'email' | 'meeting' | 'site_visit' | 'other';

  status: 'open' | 'completed' | 'snoozed' | 'cancelled';
  completedAt?: string;
  completedBy?: string;
  snoozedUntil?: string;

  createdBy: string;             // email
  createdByName?: string;

  linkedTaskId?: string;         // DevcoTask created when nextFollowupDate exists

  auditLog?: Array<{
    at: string;
    by: string;
    action: 'created' | 'updated' | 'completed' | 'snoozed' | 'reminded' | 'reopened';
    details?: string;
  }>;

  createdAt?: Date;
  updatedAt?: Date;
}

const FollowupSchema = new Schema({
  estimateNumber: { type: String, required: true, index: true },
  estimateId: { type: String, index: true },
  customerId: { type: String },
  customerName: { type: String },
  followupDate: { type: String, required: true },
  nextFollowupDate: { type: String },
  remarks: { type: String, required: true },
  suggestedAction: { type: String },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative', 'urgent'] },
  channel: { type: String, enum: ['phone', 'email', 'meeting', 'site_visit', 'other'] },
  status: { type: String, enum: ['open', 'completed', 'snoozed', 'cancelled'], default: 'open', index: true },
  completedAt: { type: String },
  completedBy: { type: String },
  snoozedUntil: { type: String },
  createdBy: { type: String, required: true, index: true },
  createdByName: { type: String },
  linkedTaskId: { type: String, index: true },
  auditLog: [{
    at: { type: String },
    by: { type: String },
    action: { type: String },
    details: { type: String },
  }],
}, { timestamps: true, collection: 'followups' });

FollowupSchema.index({ estimateNumber: 1, createdBy: 1, status: 1 });
FollowupSchema.index({ nextFollowupDate: 1, status: 1 });

if (process.env.NODE_ENV === 'development') {
  delete mongoose.models.Followup;
}

const Followup: Model<IFollowup> = mongoose.models.Followup || mongoose.model<IFollowup>('Followup', FollowupSchema);
export default Followup;
