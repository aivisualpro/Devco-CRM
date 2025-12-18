import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployee extends Omit<Document, '_id'> {
    _id: string; // email will be used as _id
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    mobile?: string;
    appRole?: string;
    companyPosition?: string;
    designation?: string;
    isScheduleActive?: boolean;
    status: string;
    groupNo?: string;
    hourlyRateSITE?: number;
    hourlyRateDrive?: number;
    dob?: string;
    driverLicense?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;

    // Documents / Checks / Dates
    applicationResume?: string;
    dateHired?: string;
    separationDate?: string;
    separationReason?: string;

    // Compliance & Files (Storing as strings for URL/Status or Booleans if simple checks, assume Strings for flexibility unless specified)
    employeeHandbook?: string;
    quickbooksW4I9DD?: string;
    workforce?: string;
    emergencyContact?: string;
    dotRelease?: string;
    dmvPullNotifications?: string;
    drivingRecordPermission?: string;
    backgroundCheck?: string;
    copyOfDL?: string;
    copyOfSS?: string;
    lcpTracker?: string;
    edd?: string;
    autoInsurance?: string;
    veriforce?: string;
    unionPaperwork1184?: string;
    profilePicture?: string;


    createdAt?: Date;
    updatedAt?: Date;
}

const EmployeeSchema: Schema = new Schema({
    _id: { type: String, required: true }, // email as _id
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    mobile: { type: String },
    appRole: { type: String },
    companyPosition: { type: String },
    designation: { type: String },
    isScheduleActive: { type: Boolean, default: true },
    status: { type: String, default: 'Active' },
    groupNo: { type: String },
    hourlyRateSITE: { type: Number },
    hourlyRateDrive: { type: Number },
    dob: { type: String },
    driverLicense: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },

    applicationResume: { type: String },
    dateHired: { type: String },
    separationDate: { type: String },
    separationReason: { type: String },

    employeeHandbook: { type: String },
    quickbooksW4I9DD: { type: String },
    workforce: { type: String },
    emergencyContact: { type: String },
    dotRelease: { type: String },
    dmvPullNotifications: { type: String },
    drivingRecordPermission: { type: String },
    backgroundCheck: { type: String },
    copyOfDL: { type: String },
    copyOfSS: { type: String },
    lcpTracker: { type: String },
    edd: { type: String },
    autoInsurance: { type: String },
    veriforce: { type: String },
    unionPaperwork1184: { type: String },
    profilePicture: { type: String },


}, {
    timestamps: true,
    collection: 'devcoEmployees'
});


// Prevent model overwrite in development
const Employee: Model<IEmployee> = mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);

export default Employee;
