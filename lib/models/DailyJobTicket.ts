import mongoose, { Schema, Document } from 'mongoose';
import { IEquipmentUsed } from './Schedule';

export interface IDailyJobTicket extends Document {
    schedule_id: string;
    dailyJobDescription: string;
    customerPrintName: string;
    customerSignature: string;
    createdBy: string;
    clientEmail?: string;
    emailCounter?: number;
    djtCost?: number;
    equipmentUsed?: IEquipmentUsed[];
    djtimages?: string[];
    signatures?: {
        employee: string;
        signature: string;
        date?: Date;
        location?: string;
        signedBy?: string;
        lunchStart?: string;
        lunchEnd?: string;
        clockOut?: string;
    }[];
    djtEmails?: { emailto: string; createdAt: Date }[];
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
    emailCounter: { type: Number, default: 0 },
    djtCost: { type: Number, default: 0 },
    equipmentUsed: [{
        equipment: { type: String },
        type: { type: String, enum: ['owned', 'rental'] },
        qty: { type: Number },
        cost: { type: Number }
    }],
    djtimages: { type: [String], default: [] },
    signatures: [{
        employee: { type: String },
        signature: { type: String },
        date: { type: Date, default: Date.now },
        location: { type: String },
        signedBy: { type: String },
        lunchStart: { type: String },
        lunchEnd: { type: String },
        clockOut: { type: String }
    }],
    djtEmails: [{
        emailto: { type: String },
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.DailyJobTicket) {
    delete mongoose.models.DailyJobTicket;
}
const DailyJobTicket = mongoose.model<IDailyJobTicket>('DailyJobTicket', DailyJobTicketSchema);

export default DailyJobTicket;
