import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEstimate extends Document {
    estimate?: string;
    date?: string;
    customer?: string;
    customerName?: string;
    customerId?: string;
    contactName?: string;
    contactId?: string;
    contactEmail?: string;
    contactPhone?: string;
    jobAddress?: string;

    projectTitle?: string;
    projectName?: string; // New field
    proposalNumber?: string;
    proposalNo?: string;
    status?: string;
    notes?: string;
    fringe?: string;

    bidMarkUp?: string;
    confirmed?: boolean;

    proposalWriter?: string;
    certifiedPayroll?: string;



    // Totals
    subTotal?: number;
    margin?: number;
    grandTotal?: number;
    versionNumber?: number;
    createdAt?: Date;
    updatedAt?: Date;

    // Template & Proposal Support
    templateId?: string;
    proposal?: {
        templateId: string;
        templateVersion: number;
        generatedAt: Date;
        pdfUrl?: string;
        htmlContent: string;
    };
    // Custom variable values filled by user
    customVariables?: Record<string, string>;
}

const EstimateSchema = new Schema({
    _id: { type: String, required: true },
    estimate: { type: String },
    date: { type: String },
    customer: { type: String },
    customerName: { type: String },
    customerId: { type: String },
    contactName: { type: String },
    contactId: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    jobAddress: { type: String },

    projectTitle: { type: String },
    projectName: { type: String }, // New field
    proposalNumber: { type: String },
    proposalNo: { type: String },
    status: { type: String },
    notes: { type: String },
    fringe: { type: String },

    bidMarkUp: { type: String },

    proposalWriter: { type: String },
    certifiedPayroll: { type: String },




    services: { type: [String], default: [] },
    // Totals
    subTotal: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    versionNumber: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // Template & Proposal fields
    templateId: { type: String },
    proposal: {
        templateId: { type: String },
        templateVersion: { type: Number },
        generatedAt: { type: Date },
        pdfUrl: { type: String },
        htmlContent: { type: String }
    },
    customVariables: { type: Object, default: {} }
}, {
    _id: false,
    timestamps: true,
    strict: false,  // Allow additional fields not in schema
    collection: 'estimatesdb'
});

// Force model recompilation in dev to apply schema changes
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Estimate;
}

const Estimate: Model<IEstimate> = mongoose.models.Estimate || mongoose.model<IEstimate>('Estimate', EstimateSchema);

export default Estimate;
