import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUsa811Ticket extends Document {
    ticketNo: string;
    type: string;
    status: string;
    requestDate: Date;
    expirationDate?: Date;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    latitude?: number;
    longitude?: number;
    utilities?: string[];
    remarks?: string;
    estimate?: string;
    projectName?: string;
    callerName?: string;
    contactPhone?: string;
    excavator?: string;
    workDescription?: string;
    responseDate?: Date;
    uploads?: any[];
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
    legacyId?: string;
}

const Usa811TicketSchema = new Schema<IUsa811Ticket>(
    {
        ticketNo: { type: String, required: true, index: true },
        type: { type: String, default: 'Normal' },
        status: { type: String, default: 'Open' },
        requestDate: { type: Date },
        expirationDate: { type: Date },
        address: { type: String, default: '' },
        city: { type: String },
        state: { type: String },
        zip: { type: String },
        county: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
        utilities: [{ type: String }],
        remarks: { type: String },
        estimate: { type: String },
        projectName: { type: String },
        callerName: { type: String },
        contactPhone: { type: String },
        excavator: { type: String },
        workDescription: { type: String },
        responseDate: { type: Date },
        uploads: { type: Schema.Types.Mixed, default: [] },
        createdBy: { type: String },
        legacyId: { type: String, index: true },
    },
    { timestamps: true }
);

const Usa811Ticket: Model<IUsa811Ticket> =
    mongoose.models.Usa811Ticket || mongoose.model<IUsa811Ticket>('Usa811Ticket', Usa811TicketSchema);

export default Usa811Ticket;
