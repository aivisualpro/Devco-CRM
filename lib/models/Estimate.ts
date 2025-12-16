import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEstimate extends Document {
    estimate?: string;
    date?: string;
    customer?: string;
    customerName?: string;
    customerId?: string;
    projectTitle?: string;
    proposalNumber?: string;
    proposalNo?: string;
    status?: string;
    notes?: string;
    fringe?: string;

    bidMarkUp?: string;
    // Service flags
    directionalDrilling?: boolean;
    excavationBackfill?: boolean;
    hydroExcavation?: boolean;
    potholingCoring?: boolean;
    asphaltConcrete?: boolean;
    confirmed?: boolean;
    // Totals
    subTotal?: number;
    margin?: number;
    grandTotal?: number;
    versionNumber?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const EstimateSchema = new Schema({
    _id: { type: String, required: true },
    estimate: { type: String },
    date: { type: String },
    customer: { type: String },
    customerName: { type: String },
    customerId: { type: String },
    projectTitle: { type: String },
    proposalNumber: { type: String },
    proposalNo: { type: String },
    status: { type: String },
    notes: { type: String },
    fringe: { type: String },

    bidMarkUp: { type: String },
    // Service flags
    directionalDrilling: { type: Boolean, default: false },
    excavationBackfill: { type: Boolean, default: false },
    hydroExcavation: { type: Boolean, default: false },
    potholingCoring: { type: Boolean, default: false },
    asphaltConcrete: { type: Boolean, default: false },
    foundations: { type: Boolean, default: false },
    trafficLoops: { type: Boolean, default: false },
    splicing: { type: Boolean, default: false },
    roadBoring: { type: Boolean, default: false },
    streetLighting: { type: Boolean, default: false },
    confirmed: { type: Boolean, default: false },
    // Totals
    subTotal: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    versionNumber: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    _id: false,
    timestamps: true,
    strict: false,  // Allow additional fields not in schema
    collection: 'estimatesdb'
});

const Estimate: Model<IEstimate> = mongoose.models.Estimate || mongoose.model<IEstimate>('Estimate', EstimateSchema);

export default Estimate;
