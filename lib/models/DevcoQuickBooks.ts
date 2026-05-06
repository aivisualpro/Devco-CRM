import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQuickBooksTransaction {
    transactionId: string;
    date: Date;
    transactionType: string;
    split: string;
    fromTo: string;
    projectId: string; // Linked to parent projectId
    amount: number;
    memo: string;
    status: string;
    no: string;
    account: string; // QB expense account (e.g. "Payroll expenses:Wages")
}

export interface IDevcoQuickBooks extends Document {
    projectId: string;
    project: string;
    customer: string;
    startDate?: Date;
    endDate?: Date;
    status: string;
    proposalNumber?: string;
    manualOriginalContract?: number;
    manualChangeOrders?: number;
    transactions: IQuickBooksTransaction[];
    income: number;
    qbCost: number;
    devcoCost: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const QuickBooksTransactionSchema = new Schema({
    transactionId: { type: String },
    date: { type: Date },
    transactionType: { type: String },
    split: { type: String },
    fromTo: { type: String },
    projectId: { type: String },
    amount: { type: Number, default: 0 },
    memo: { type: String },
    status: { type: String, default: 'Paid' },
    no: { type: String, default: '' },
    account: { type: String, default: '' }
});

const DevcoQuickBooksSchema = new Schema({
    projectId: { type: String, required: true, unique: true },
    project: { type: String },
    customer: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String },
    proposalNumber: { type: String },
    manualOriginalContract: { type: Number },
    manualChangeOrders: { type: Number },
    transactions: { type: [QuickBooksTransactionSchema], default: [] },
    income: { type: Number, default: 0 },
    qbCost: { type: Number, default: 0 },
    devcoCost: { type: Number, default: 0 }
}, {
    timestamps: true,
    collection: 'devcoquickbooks'
});

// Handle Next.js Hot Reload
const DevcoQuickBooks = mongoose.models.DevcoQuickBooks || mongoose.model('DevcoQuickBooks', DevcoQuickBooksSchema);

export default DevcoQuickBooks;
