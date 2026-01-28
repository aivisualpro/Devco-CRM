import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDevcoTask extends Document {
    task: string;
    dueDate?: Date;
    assignees: string[];
    status: 'todo' | 'in progress' | 'done';
    createdBy: string;
    createdAt: Date;
    lastUpdatedBy?: string;
    lastUpdatedAt?: Date;
}

const DevcoTaskSchema = new Schema({
    task: { type: String, required: true },
    dueDate: { type: Date },
    assignees: { type: [String], default: [] },
    status: { 
        type: String, 
        enum: ['todo', 'in progress', 'done'], 
        default: 'todo' 
    },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastUpdatedBy: { type: String },
    lastUpdatedAt: { type: Date, default: Date.now }
}, {
    collection: 'devcoTasks'
});

const DevcoTask: Model<IDevcoTask> = mongoose.models.devcoTasks || mongoose.model<IDevcoTask>('devcoTasks', DevcoTaskSchema);

export default DevcoTask;
