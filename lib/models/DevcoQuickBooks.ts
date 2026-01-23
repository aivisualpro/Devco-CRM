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
}

export interface IDevcoQuickBooks extends Document {
    projectId: string;
    project: string;
    customer: string;
    startDate?: Date;
    endDate?: Date;
    status: string;
    proposalNumber?: string;
    transactions: IQuickBooksTransaction[];
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
    memo: { type: String }
});

const DevcoQuickBooksSchema = new Schema({
    projectId: { type: String, required: true, unique: true },
    project: { type: String },
    customer: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String },
    proposalNumber: { type: String },
    transactions: { type: [QuickBooksTransactionSchema], default: [] }
}, {
    timestamps: true,
    collection: 'devcoquickbooks'
});

// Handle Next.js Hot Reload
if (mongoose.models.DevcoQuickBooks) {
    delete mongoose.models.DevcoQuickBooks;
}

const DevcoQuickBooks: Model<IDevcoQuickBooks> = mongoose.model<IDevcoQuickBooks>('DevcoQuickBooks', DevcoQuickBooksSchema);

export default DevcoQuickBooks;
