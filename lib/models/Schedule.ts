import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPreBoreLogItem {
    _id?: string;
    rodNumber: string;
    distance: string;
    topDepth: string;
    bottomDepth: string;
    overOrUnder: string;
    existingUtilities: string;
    picture?: string;
    createdBy: string;
    createdAt?: Date;
}

export interface IPreBore {
    legacyId?: string;
    date?: Date;
    customerForeman?: string;
    customerWorkRequestNumber?: string;
    startTime?: string;
    addressBoreStart?: string;
    addressBoreEnd?: string;
    devcoOperator?: string;
    drillSize?: string;
    pilotBoreSize?: string;
    reamerSize6?: string;
    reamerSize8?: string;
    reamerSize10?: string;
    reamerSize12?: string;
    soilType?: string;
    boreLength?: string;
    pipeSize?: string;
    foremanSignature?: string;
    customerName?: string;
    customerSignature?: string;
    preBoreLogs?: IPreBoreLogItem[];
    createdBy?: string;
    createdAt?: Date;
}

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
    djt?: IDJT;
    preBore?: IPreBore[];
    JHASignatures?: any[];
    DJTSignatures?: any[];
    todayObjectives?: IObjective[];
    syncedToAppSheet?: boolean;
    isDayOffApproved?: boolean;
}

export interface IDJT {
    _id?: string;
    dailyJobDescription?: string;
    customerPrintName?: string;
    customerSignature?: string;
    djtTime?: string;
    equipmentUsed?: IEquipmentUsed[];
    djtimages?: string[];
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
    clientEmail?: string;
    emailCounter?: number;
    signatures?: any[]; // For frontend convenience
    schedule_id?: string;
    djtCost?: number;
}

export interface IEquipmentUsed {
    equipment: string; // Equipment Item ID
    type: 'owned' | 'rental';
    qty: number;
    cost: number;
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
    shopTime?: string; // string
    comments?: string; // long text
    createdBy?: string;
    createdAt?: string; 
    manualDistance?: string;
    manualDuration?: string;
    distance?: number;
    hours?: number;
    qty?: number;
    dumpQty?: number;
    shopQty?: number;
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
    shopTime: { type: String },
    comments: { type: String },
    createdBy: { type: String },
    createdAt: { type: String },
    manualDistance: { type: String },
    manualDuration: { type: String },
    distance: { type: Number },
    hours: { type: Number },
    qty: { type: Number, default: 1 },
    dumpQty: { type: Number },
    shopQty: { type: Number }
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
    djt: { 
        type: {
            _id: { type: String },
            dailyJobDescription: { type: String },
            customerPrintName: { type: String },
            customerSignature: { type: String },
            djtTime: { type: String },
            equipmentUsed: [{
                equipment: { type: String },
                type: { type: String, enum: ['owned', 'rental'] },
                qty: { type: Number },
                cost: { type: Number }
            }],
            djtimages: { type: [String] },
            createdBy: { type: String },
            createdAt: { type: Date },
            updatedAt: { type: Date },
            clientEmail: { type: String },
            emailCounter: { type: Number },
            djtEmails: [{
                emailto: { type: String },
                createdAt: { type: Date, default: Date.now }
            }],
            signatures: { type: [], default: [] },
            djtCost: { type: Number, default: 0 }
        }, 
        default: null 
    },
    JHASignatures: { type: [], default: [] },
    DJTSignatures: { type: [], default: [] },
    todayObjectives: { type: [{
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
        completedBy: { type: String },
        completedAt: { type: Date }
    }], default: [] },
    preBore: {
        type: [{
            legacyId: { type: String },
            date: { type: Date },
            customerForeman: { type: String },
            customerWorkRequestNumber: { type: String },
            startTime: { type: String },
            addressBoreStart: { type: String },
            addressBoreEnd: { type: String },
            devcoOperator: { type: String },
            drillSize: { type: String },
            pilotBoreSize: { type: String },
            reamerSize6: { type: String },
            reamerSize8: { type: String },
            reamerSize10: { type: String },
            reamerSize12: { type: String },
            soilType: { type: String },
            boreLength: { type: String },
            pipeSize: { type: String },
            foremanSignature: { type: String },
            customerName: { type: String },
            customerSignature: { type: String },
            preBoreLogs: [{
                _id: { type: String },
                rodNumber: { type: String, default: '' },
                distance: { type: String, default: '' },
                topDepth: { type: String, default: '' },
                bottomDepth: { type: String, default: '' },
                overOrUnder: { type: String, default: '' },
                existingUtilities: { type: String, default: '' },
                picture: { type: String, default: '' },
                createdBy: { type: String, default: '' },
                createdAt: { type: Date, default: Date.now }
            }],
            createdBy: { type: String },
            createdAt: { type: Date }
        }],
        default: []
    },
    syncedToAppSheet: { type: Boolean, default: false },
    isDayOffApproved: { type: Boolean, default: false }
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

if (mongoose.models.Schedule) {
    delete mongoose.models.Schedule;
}

const Schedule: Model<ISchedule> = mongoose.model<ISchedule>('Schedule', ScheduleSchema);

export default Schedule;
