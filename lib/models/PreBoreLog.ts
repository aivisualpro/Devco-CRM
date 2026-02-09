import mongoose, { Schema, Document } from 'mongoose';

export interface IPreBoreLogItem {
    _id?: string;
    legacyId?: string;
    rodNumber: string;
    distance: string;
    topDepth: string;
    bottomDepth: string;
    overOrUnder: string;
    existingUtilities: string;
    picture?: string;
    createdBy: string;
    createdAt: Date;
}

export interface IPreBoreLog extends Document {
    legacyId?: string;
    scheduleId?: string;
    date: Date;
    customerForeman: string;
    customerWorkRequestNumber: string;
    startTime: string;
    addressBoreStart: string;
    addressBoreEnd: string;
    devcoOperator: string;
    drillSize: string;
    pilotBoreSize: string;
    reamerSize6: string;
    reamerSize8: string;
    reamerSize10: string;
    reamerSize12: string;
    soilType: string;
    boreLength: string;
    pipeSize: string;
    foremanSignature: string;
    customerName: string;
    customerSignature: string;
    preBoreLogs: IPreBoreLogItem[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const PreBoreLogItemSchema = new Schema({
    _id: { type: String },
    legacyId: { type: String, default: '' },
    rodNumber: { type: String, default: '' },
    distance: { type: String, default: '' },
    topDepth: { type: String, default: '' },
    bottomDepth: { type: String, default: '' },
    overOrUnder: { type: String, default: '' },
    existingUtilities: { type: String, default: '' },
    picture: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const PreBoreLogSchema: Schema = new Schema({
    _id: { type: String },
    legacyId: { type: String, default: '' },
    scheduleId: { type: String, default: '' },
    date: { type: Date, required: true },
    customerForeman: { type: String, default: '' },
    customerWorkRequestNumber: { type: String, default: '' },
    startTime: { type: String, default: '' },
    addressBoreStart: { type: String, default: '' },
    addressBoreEnd: { type: String, default: '' },
    devcoOperator: { type: String, default: '' },
    drillSize: { type: String, default: '' },
    pilotBoreSize: { type: String, default: '' },
    reamerSize6: { type: String, default: '' },
    reamerSize8: { type: String, default: '' },
    reamerSize10: { type: String, default: '' },
    reamerSize12: { type: String, default: '' },
    soilType: { type: String, default: '' },
    boreLength: { type: String, default: '' },
    pipeSize: { type: String, default: '' },
    foremanSignature: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerSignature: { type: String, default: '' },
    preBoreLogs: [PreBoreLogItemSchema],
    createdBy: { type: String, required: true }
}, {
    timestamps: true,
    collection: 'preborelogs'
});

// Force model recompilation to ensure schema changes are picked up
if (mongoose.models.PreBoreLog) {
    delete mongoose.models.PreBoreLog;
}

const PreBoreLog = mongoose.model<IPreBoreLog>('PreBoreLog', PreBoreLogSchema);

export default PreBoreLog;
