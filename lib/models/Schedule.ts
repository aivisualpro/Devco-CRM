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
    assignees: string[];
    description: string;
    service: string;
    item: string;
    fringe: string;
    certifiedPayroll: string;
    notifyAssignees: string;
    perDiem: string;
    aerialImage?: string;
    siteLayout?: string;
    createdAt?: Date;
    updatedAt?: Date;
    timesheet?: ITimesheet[];
    djt?: any;
    JHASignatures?: any[];
    DJTSignatures?: any[];
    todayObjectives?: IObjective[];
}

export interface IObjective {
    text: string;
    completed: boolean;
    completedBy?: string; // Employee email who completed it
    completedAt?: Date;   // When it was completed
}

export interface ITimesheet {
    _id: string; // Object _id when import
    employee: string;
    scheduleId: string; // Reference of devcoschedule _id
    jhaId?: string;
    ticket_id?: string;
    type?: string;
    client_id?: string;
    estimateId?: string;
    clockIn?: string; // date & time like this 9/8/2024 5:06:07 PM
    lunchStart?: string; // date & time like this 9/8/2024 5:06:07 PM
    lunchEnd?: string; // date & time like this 9/8/2024 5:06:07 PM
    clockOut?: string; // date & time like this 9/8/2024 5:06:07 PM
    locationIn?: string; // latlong like 34.058392, -117.786035
    locationOut?: string; // latlong like 34.058392, -117.786035
    hourlyRateSITE?: string; // $ value (stored as string based on request, or number if parsed) - User said "$ value", usually string in import but helpful as number. User request: "$ value"
    hourlyRateDrive?: string; // $ value
    dumpWashout?: string; // string
    comments?: string; // long text
    createdBy?: string;
    createdAt?: string; 
    manualDistance?: string;
    manualDuration?: string;
    distance?: number;
    hours?: number;
}

const TimesheetSchema = new Schema({
    _id: { type: String },
    employee: { type: String },
    scheduleId: { type: String },
    jhaId: { type: String },
    ticket_id: { type: String },
    type: { type: String },
    client_id: { type: String },
    estimateId: { type: String },
    clockIn: { type: String },
    lunchStart: { type: String },
    lunchEnd: { type: String },
    clockOut: { type: String },
    locationIn: { type: String },
    locationOut: { type: String },
    hourlyRateSITE: { type: String },
    hourlyRateDrive: { type: String },
    dumpWashout: { type: String },
    comments: { type: String },
    createdBy: { type: String },
    createdAt: { type: String },
    manualDistance: { type: String },
    manualDuration: { type: String },
    distance: { type: Number },
    hours: { type: Number }
});

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
    assignees: { type: [String], default: [] },
    description: { type: String },
    service: { type: String },
    item: { type: String },
    fringe: { type: String },
    certifiedPayroll: { type: String },
    notifyAssignees: { type: String, default: 'No' },
    perDiem: { type: String, default: 'No' },
    aerialImage: { type: String },
    siteLayout: { type: String },
    timesheet: { type: [TimesheetSchema], default: [] },
    jha: { type: Object, default: null },
    djt: { type: Object, default: null },
    JHASignatures: { type: [], default: [] },
    DJTSignatures: { type: [], default: [] },
    todayObjectives: { type: [{
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
        completedBy: { type: String },
        completedAt: { type: Date }
    }], default: [] }
}, {
    timestamps: true,
    collection: 'devcoschedules'
});

// Add indexes for faster queries
ScheduleSchema.index({ fromDate: -1 });
ScheduleSchema.index({ projectManager: 1 });
ScheduleSchema.index({ foremanName: 1 });
ScheduleSchema.index({ assignees: 1 });
ScheduleSchema.index({ customerId: 1 });

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Schedule;
}

const Schedule: Model<ISchedule> = mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);

export default Schedule;
