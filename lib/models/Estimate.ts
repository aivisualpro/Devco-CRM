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
    extension?: string;
    jobAddress?: string;
    projectTitle?: string;
    projectName?: string;
    proposalNumber?: string;
    proposalNo?: string;
    status?: string;
    notes?: string;
    fringe?: string;
    bidMarkUp?: string;
    confirmed?: boolean;
    proposalWriter?: string;
    certifiedPayroll?: string;

    // New fields
    customerJobNumber?: string;
    accountingContact?: string;
    accountingEmail?: string;
    accountingPhone?: string; // Added field
    PoORPa?: string;
    poName?: string;
    PoAddress?: string;
    PoPhone?: string;
    ocName?: string;
    ocAddress?: string;
    ocPhone?: string;
    subCName?: string;
    subCAddress?: string;
    subCPhone?: string;
    liName?: string;
    liAddress?: string;
    liPhone?: string;
    scName?: string;
    scAddress?: string;
    scPhone?: string;
    bondNumber?: string;
    projectId?: string;
    fbName?: string;
    fbAddress?: string;
    eCPRSystem?: string;
    typeOfServiceRequired?: string;
    wetUtilities?: string;
    dryUtilities?: string;
    projectDescription?: string;
    estimatedStartDate?: string;
    estimatedCompletionDate?: string;
    siteConditions?: string;
    prelimAmount?: string;
    billingTerms?: string;
    otherBillingTerms?: string;

    // Totals & Meta
    subTotal?: number;
    margin?: number;
    grandTotal?: number;
    versionNumber?: number;
    createdAt?: Date;
    updatedAt?: Date;

    // Template & Proposal Success
    templateId?: string;
    proposal?: {
        templateId: string;
        templateVersion: number;
        generatedAt: Date;
        pdfUrl?: string;
        htmlContent: string;
    };
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
    extension: { type: String },
    jobAddress: { type: String },

    projectTitle: { type: String },
    projectName: { type: String }, // New field
    proposalNumber: { type: String },
    proposalNo: { type: String },
    status: { type: String, default: 'pending' },
    notes: { type: String },
    fringe: { type: String },

    bidMarkUp: { type: String },

    proposalWriter: { type: String },
    certifiedPayroll: { type: String },

    // New fields
    customerJobNumber: { type: String },
    accountingContact: { type: String },
    accountingEmail: { type: String },
    accountingPhone: { type: String },
    PoORPa: { type: String },
    poName: { type: String },
    PoAddress: { type: String },
    PoPhone: { type: String },
    ocName: { type: String },
    ocAddress: { type: String },
    ocPhone: { type: String },
    subCName: { type: String },
    subCAddress: { type: String },
    subCPhone: { type: String },
    liName: { type: String },
    liAddress: { type: String },
    liPhone: { type: String },
    scName: { type: String },
    scAddress: { type: String },
    scPhone: { type: String },
    bondNumber: { type: String },
    projectId: { type: String },
    fbName: { type: String },
    fbAddress: { type: String },
    eCPRSystem: { type: String },
    typeOfServiceRequired: { type: String },
    wetUtilities: { type: String },
    dryUtilities: { type: String },
    projectDescription: { type: String },
    estimatedStartDate: { type: String },
    estimatedCompletionDate: { type: String },
    siteConditions: { type: String },
    prelimAmount: { type: String },
    billingTerms: { type: String },
    otherBillingTerms: { type: String },


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
