
import mongoose, { Schema, Document } from 'mongoose';

export interface IJHA extends Document {
    schedule_id: string;
    date: Date;
    jhaTime: string;
    usaNo: string;
    subcontractorUSANo: string;
    operatingMiniEx: boolean;
    operatingAVacuumTruck: boolean;
    excavatingTrenching: boolean;
    acConcWork: boolean;
    operatingBackhoe: boolean;
    workingInATrench: boolean;
    trafficControl: boolean;
    roadWork: boolean;
    operatingHdd: boolean;
    confinedSpace: boolean;
    settingUgBoxes: boolean;
    otherDailyWork: boolean;
    commentsOtherDailyWork?: string;
    sidewalks: boolean;
    commentsOnSidewalks?: string;
    heatAwareness: boolean;
    commentsOnHeatAwareness?: string;
    ladderWork: boolean;
    commentsOnLadderWork?: string;
    overheadLifting: boolean;
    commentsOnOverheadLifting?: string;
    materialHandling: boolean;
    commentsOnMaterialHandling?: string;
    roadHazards: boolean;
    commentsOnRoadHazards?: string;
    heavyLifting: boolean;
    commentsOnHeavyLifting?: string;
    highNoise: boolean;
    commentsOnHighNoise?: string;
    pinchPoints: boolean;
    commentsOnPinchPoints?: string;
    sharpObjects: boolean;
    commentsOnSharpObjects?: string;
    trippingHazards: boolean;
    commentsOnTrippingHazards?: string;
    otherJobsiteHazards: boolean;
    commentsOnOther?: string;
    anySpecificNotes?: string;
    stagingAreaDiscussed: boolean;
    rescueProceduresDiscussed: boolean;
    evacuationRoutesDiscussed: boolean;
    emergencyContactNumberWillBe911: boolean;
    firstAidAndCPREquipmentOnsite: boolean;
    closestHospitalDiscussed: boolean;
    nameOfHospital?: string;
    addressOfHospital?: string;
    createdBy: string;
    clientEmail?: string;
    emailCounter?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const JHASchema: Schema = new Schema({
    _id: { type: String },
    schedule_id: { type: String, ref: 'Schedule', required: true },
    date: { type: Date, required: true },
    jhaTime: { type: String, required: true },
    usaNo: { type: String, default: '' },
    subcontractorUSANo: { type: String, default: '' },
    operatingMiniEx: { type: Boolean, default: false },
    operatingAVacuumTruck: { type: Boolean, default: false },
    excavatingTrenching: { type: Boolean, default: false },
    acConcWork: { type: Boolean, default: false },
    operatingBackhoe: { type: Boolean, default: false },
    workingInATrench: { type: Boolean, default: false },
    trafficControl: { type: Boolean, default: false },
    roadWork: { type: Boolean, default: false },
    operatingHdd: { type: Boolean, default: false },
    confinedSpace: { type: Boolean, default: false },
    settingUgBoxes: { type: Boolean, default: false },
    otherDailyWork: { type: Boolean, default: false },
    commentsOtherDailyWork: { type: String, default: '' },
    sidewalks: { type: Boolean, default: false },
    commentsOnSidewalks: { type: String, default: '' },
    heatAwareness: { type: Boolean, default: false },
    commentsOnHeatAwareness: { type: String, default: '' },
    ladderWork: { type: Boolean, default: false },
    commentsOnLadderWork: { type: String, default: '' },
    overheadLifting: { type: Boolean, default: false },
    commentsOnOverheadLifting: { type: String, default: '' },
    materialHandling: { type: Boolean, default: false },
    commentsOnMaterialHandling: { type: String, default: '' },
    roadHazards: { type: Boolean, default: false },
    commentsOnRoadHazards: { type: String, default: '' },
    heavyLifting: { type: Boolean, default: false },
    commentsOnHeavyLifting: { type: String, default: '' },
    highNoise: { type: Boolean, default: false },
    commentsOnHighNoise: { type: String, default: '' },
    pinchPoints: { type: Boolean, default: false },
    commentsOnPinchPoints: { type: String, default: '' },
    sharpObjects: { type: Boolean, default: false },
    commentsOnSharpObjects: { type: String, default: '' },
    trippingHazards: { type: Boolean, default: false },
    commentsOnTrippingHazards: { type: String, default: '' },
    otherJobsiteHazards: { type: Boolean, default: false },
    commentsOnOther: { type: String, default: '' },
    anySpecificNotes: { type: String, default: '' },
    stagingAreaDiscussed: { type: Boolean, default: false },
    rescueProceduresDiscussed: { type: Boolean, default: false },
    evacuationRoutesDiscussed: { type: Boolean, default: false },
    emergencyContactNumberWillBe911: { type: Boolean, default: false },
    firstAidAndCPREquipmentOnsite: { type: Boolean, default: false },
    closestHospitalDiscussed: { type: Boolean, default: false },
    nameOfHospital: { type: String, default: '' },
    addressOfHospital: { type: String, default: '' },
    createdBy: { type: String, required: true },
    clientEmail: { type: String, default: '' },
    emailCounter: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.JHA) {
    delete mongoose.models.JHA;
}
const JHA = mongoose.model<IJHA>('JHA', JHASchema);

export default JHA;
