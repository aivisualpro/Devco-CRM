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
    contactAddress?: string;
    extension?: string;
    jobAddress?: string;
    projectTitle?: string;
    projectName?: string;
    proposalNumber?: string;
    status?: string;
    notes?: string;
    fringe?: string;
    bidMarkUp?: string;
    confirmed?: boolean;
    proposalWriter?: string | string[];
    certifiedPayroll?: string;
    prevailingWage?: boolean;
    isChangeOrder?: boolean;
    parentVersionId?: string;
    aerialImage?: string;
    siteLayout?: string;

    // New fields
    createdBy?: string;
    customerJobNumber?: string;
    customerPONumber?: string;
    workRequestNumber?: string;
    subContractAgreementNumber?: string;
    dirNumber?: string;
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
    customerPONo?: string;
    workRequestNo?: string;
    subContractAgreementNo?: string;
    customerJobNo?: string;
    DIRProjectNo?: string;

    wetUtilities?: string;
    dryUtilities?: string;
    projectDescription?: string;
    estimatedStartDate?: string;
    estimatedCompletionDate?: string;
    siteConditions?: string;
    prelimAmount?: string;
    billingTerms?: string;
    otherBillingTerms?: string;
    usaNumber?: string;
    receiptsAndCosts?: Array<{
        _id?: string;
        estimate?: string;
        type: 'Invoice' | 'Receipt';
        vendor?: string;
        amount?: number;
        date?: string;
        dueDate?: string;
        upload?: Array<{
            name: string;
            url: string;
            type: string;
        }>;
        remarks?: string;
        tag?: string[];
        createdBy?: string;
        createdAt?: Date;
        approvalStatus?: 'Approved' | 'Not Approved';
        status?: 'Devco Paid' | '';
        paidBy?: string;
        paymentDate?: string;
    }>;
    signedContracts?: Array<{
        date?: string;
        amount?: number;
        attachments?: Array<{
            name: string;
            url: string;
            type: string;
            thumbnailUrl?: string;
        }>;
    }>;
    syncedToAppSheet?: boolean;

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
    // Store multiple proposals keyed by templateId
    proposals?: Array<{
        _id?: string;
        templateId: string;
        templateVersion?: number;
        generatedAt: Date;
        pdfUrl?: string;
        htmlContent: string;
        customPages?: Array<{ content: string }>;
        services?: string[];
    }>;
    customVariables?: Record<string, string>;
    services?: string[];
    jobPlanningDocs?: Array<{
        _id?: string;
        planningType?: string;
        usaTicketNo?: string;
        dateSubmitted?: string;
        activationDate?: string;
        expirationDate?: string;
        documentName?: string;
        documents?: Array<{
            name: string;
            url: string;
            type: string;
            uploadedAt?: string;
        }>;
        createdAt?: Date;
        updatedAt?: Date;
    }>;
    billingTickets?: Array<{
        _id?: string;
        estimate?: string;
        date?: string;
        billingTerms?: 'COD' | 'Net 30' | 'Net 45' | 'Net 60' | 'Other' | '';
        otherBillingTerms?: string;
        uploads?: Array<{
            name: string;
            url: string;
            type: string;
            thumbnailUrl?: string;
        }>;
        titleDescriptions?: Array<{
            title: string;
            description: string;
        }>;
        lumpSum?: string;
        createdBy?: string;
        createdAt?: Date;
    }>;
    coiDocument?: {
        url: string;
        name: string;
        uploadedAt: string;
    };
    legalDocs?: Array<{
        url: string;
        name: string;
        type: string;
        uploadedAt: string;
    }>;
    intentToLien?: Array<{
        _id?: string;
        arBalance?: string;
        fromDate?: string;
        toDate?: string;
        dueDate?: string;
        createdAt?: Date;
    }>;
    releases?: Array<{
        _id?: string;
        documentType?: string;
        date?: string;
        amountOfCheck?: string;
        DatesOfWaiverRelease?: string[];
        amountsOfUnpaidProgressPayment?: string[];
        receivedProgressPayments?: string[];
        disputedClaims?: string;
        documentId?: string;
        createdBy?: string;
        createdAt?: string;
    }>;

    // Line Items
    labor?: any[];
    equipment?: any[];
    material?: any[];
    tools?: any[];
    overhead?: any[];
    subcontractor?: any[];
    disposal?: any[];
    miscellaneous?: any[];
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
    contactAddress: { type: String },
    extension: { type: String },
    jobAddress: { type: String },

    projectTitle: { type: String },
    projectName: { type: String }, // New field
    proposalNumber: { type: String },
    status: { type: String, default: 'pending' },
    notes: { type: String },
    fringe: { type: String },

    bidMarkUp: { type: String },

    proposalWriter: { type: Schema.Types.Mixed }, // string or string[]
    certifiedPayroll: { type: String },
    prevailingWage: { type: Boolean }, // New field displayed if certifiedPayroll is Yes
    isChangeOrder: { type: Boolean, default: false },
    parentVersionId: { type: String },
    aerialImage: { type: String },
    siteLayout: { type: String },

    // New fields
    createdBy: { type: String },
    customerJobNumber: { type: String },
    customerPONumber: { type: String },
    workRequestNumber: { type: String },
    subContractAgreementNumber: { type: String },
    dirNumber: { type: String },
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
    customerPONo: { type: String },
    workRequestNo: { type: String },
    subContractAgreementNo: { type: String },
    customerJobNo: { type: String },
    DIRProjectNo: { type: String },

    wetUtilities: { type: String },
    dryUtilities: { type: String },
    projectDescription: { type: String },
    estimatedStartDate: { type: String },
    estimatedCompletionDate: { type: String },
    siteConditions: { type: String },
    prelimAmount: { type: String },
    billingTerms: { type: String },
    otherBillingTerms: { type: String },
    usaNumber: { type: String },
    receiptsAndCosts: [{
        _id: { type: String },
        estimate: { type: String },
        type: { type: String, enum: ['Invoice', 'Receipt'] },
        vendor: { type: String },
        amount: { type: Number },
        date: { type: String },
        dueDate: { type: String },
        upload: [{
            name: { type: String },
            url: { type: String },
            type: { type: String }
        }],
        remarks: { type: String },
        tag: { type: [String] },
        createdBy: { type: String },
        createdAt: { type: Date, default: Date.now },
        approvalStatus: { type: String, enum: ['Approved', 'Not Approved'], default: 'Not Approved' },
        status: { type: String, enum: ['Devco Paid', ''], default: '' },
        paidBy: { type: String },
        paymentDate: { type: String }
    }],
    signedContracts: [{
        date: { type: String },
        amount: { type: Number },
        attachments: [{
            name: { type: String },
            url: { type: String },
            type: { type: String },
            thumbnailUrl: { type: String }
        }]
    }],
    syncedToAppSheet: { type: Boolean, default: false },
    
    // Line Items
    labor: { type: [Object], default: [] },
    equipment: { type: [Object], default: [] },
    material: { type: [Object], default: [] },
    tools: { type: [Object], default: [] },
    overhead: { type: [Object], default: [] },
    subcontractor: { type: [Object], default: [] },
    disposal: { type: [Object], default: [] },
    miscellaneous: { type: [Object], default: [] },


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
    proposals: [{
        _id: { type: Schema.Types.ObjectId },
        templateId: { type: String },
        templateVersion: { type: Number },
        generatedAt: { type: Date },
        pdfUrl: { type: String },
        htmlContent: { type: String },
        customPages: { type: [Object], default: [] },
        services: { type: [String], default: [] }
    }],
    customVariables: { type: Object, default: {} },
    jobPlanningDocs: [{
        _id: { type: String },
        planningType: { type: String },
        usaTicketNo: { type: String },
        dateSubmitted: { type: String },
        activationDate: { type: String },
        expirationDate: { type: String },
        documentName: { type: String },
        documents: [{
            name: { type: String },
            url: { type: String },
            type: { type: String },
            uploadedAt: { type: String }
        }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
    billingTickets: [{
        _id: { type: String },
        estimate: { type: String },
        date: { type: String },
        billingTerms: { type: String, enum: ['COD', 'Net 30', 'Net 45', 'Net 60', 'Other', ''], default: '' },
        otherBillingTerms: { type: String },
        uploads: [{
            name: { type: String },
            url: { type: String },
            type: { type: String },
            thumbnailUrl: { type: String }
        }],
        titleDescriptions: [{
            title: { type: String },
            description: { type: String }
        }],
        lumpSum: { type: String },
        createdBy: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    coiDocument: {
        url: { type: String },
        name: { type: String },
        uploadedAt: { type: String }
    },
    legalDocs: [{
        url: { type: String },
        name: { type: String },
        type: { type: String },
        uploadedAt: { type: String }
    }],
    intentToLien: [{
        _id: { type: String },
        arBalance: { type: String },
        fromDate: { type: String },
        toDate: { type: String },
        dueDate: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    releases: [{
        _id: { type: String },
        documentType: { type: String },
        date: { type: String },
        amountOfCheck: { type: String },
        DatesOfWaiverRelease: { type: [String], default: [] },
        amountsOfUnpaidProgressPayment: { type: [String], default: [] },
        receivedProgressPayments: { type: [String], default: [] },
        disputedClaims: { type: String },
        documentId: { type: String },
        createdBy: { type: String },
        createdAt: { type: String }
    }]
}, {
    timestamps: true,
    strict: false,  // Allow additional fields not in schema
    collection: 'estimatesdb'
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.Estimate) {
    delete mongoose.models.Estimate;
}

const Estimate: Model<IEstimate> = mongoose.model<IEstimate>('Estimate', EstimateSchema);

export default Estimate;
