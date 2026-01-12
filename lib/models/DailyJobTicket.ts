
import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyJobTicket extends Document {
    schedule_id: string;
    dailyJobDescription: string;
    customerPrintName: string;
    customerSignature: string;
    createdBy: string;
    clientEmail?: string;
    emailCounter?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const DailyJobTicketSchema: Schema = new Schema({
    _id: { type: String },
    schedule_id: { type: String, ref: 'Schedule', required: true },
    dailyJobDescription: { type: String, default: '' },
    customerPrintName: { type: String, default: '' },
    customerSignature: { type: String, default: '' },
    createdBy: { type: String, required: true },
    clientEmail: { type: String, default: '' },
    emailCounter: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.DailyJobTicket) {
    delete mongoose.models.DailyJobTicket;
}
const DailyJobTicket = mongoose.model<IDailyJobTicket>('DailyJobTicket', DailyJobTicketSchema);

export default DailyJobTicket;
