import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISchedule extends Document {
    // field removed
    title: string;
    fromDate: Date;
    toDate: Date;
    customerId: string;
    customerName: string;
    estimate: string;
    jobLocation: string;
    projectManager: string;
    foremanName: string;
    SDName: string;
    assignees: string[];
    description: string;
    service: string;
    item: string;
    fringe: string;
    certifiedPayroll: string;
    notifyAssignees: string;
    perDiem: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const ScheduleSchema = new Schema({
    _id: { type: String },
    title: { type: String },
    fromDate: { type: Date },
    toDate: { type: Date },
    customerId: { type: String },
    customerName: { type: String },
    estimate: { type: String },
    jobLocation: { type: String },
    projectManager: { type: String },
    foremanName: { type: String },
    SDName: { type: String },
    assignees: { type: [String], default: [] },
    description: { type: String },
    service: { type: String },
    item: { type: String },
    fringe: { type: String },
    certifiedPayroll: { type: String },
    notifyAssignees: { type: String, default: 'No' },
    perDiem: { type: String, default: 'No' }
}, {
    timestamps: true,
    collection: 'devcoschedules'
});

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Schedule;
}

const Schedule: Model<ISchedule> = mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);

export default Schedule;
