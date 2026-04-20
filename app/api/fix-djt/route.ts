import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';

function getModel(name: string, schema: any) {
    if (mongoose.models[name]) {
        return mongoose.models[name];
    }
    return mongoose.model(name, schema);
}

const djSchema = new mongoose.Schema({}, { strict: false });
const DailyJobTicket = getModel('DailyJobTicket', djSchema);
const devcoschedulesSchema = new mongoose.Schema({}, { strict: false });
const Schedule = getModel('devcoschedules', devcoschedulesSchema);

export async function GET() {
    try {
        await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) return NextResponse.json({ success: false, error: "No DB" });

        const schedules = await db.collection('devcoschedules').find({
            $or: [
                { 'djt': { $exists: true, $ne: null }, 'djt.createdBy': { $in: [null, '', undefined] } },
            ]
        }).toArray();

        let results = [];

        for (const schedule of schedules) {
            if (!schedule.djt || !schedule.djt._id) continue;

            const standaloneDJT = await db.collection('dailyjobtickets').findOne({ _id: new mongoose.Types.ObjectId(schedule.djt._id.toString()) }) || 
                                  await db.collection('dailyjobtickets').findOne({ _id: schedule.djt._id.toString() as any });

            if (standaloneDJT) {
                // If it's missing in standaloneDJT too, see if there's a signature we can salvage
                let salvagedFrom = null;
                let salvagedValue = '';
                
                if (standaloneDJT.createdBy && standaloneDJT.createdBy !== '') {
                    salvagedFrom = 'dailyjobtickets.createdBy';
                    salvagedValue = standaloneDJT.createdBy;
                } else if (standaloneDJT.signatures && standaloneDJT.signatures.length > 0 && standaloneDJT.signatures[0].employee) {
                    salvagedFrom = 'signatures';
                    salvagedValue = standaloneDJT.signatures[0].employee;
                } else if (schedule.createdBy && schedule.createdBy !== '') {
                    salvagedFrom = 'schedule.createdBy';
                    salvagedValue = schedule.createdBy;
                }

                results.push({
                    scheduleId: schedule._id,
                    djtId: schedule.djt._id,
                    scheduleDjtCreatedBy: schedule.djt.createdBy,
                    dailyjobticketsCreatedBy: standaloneDJT.createdBy,
                    salvagedFrom,
                    salvagedValue
                });

                // Let's actually execute the update using the salvaged value
                if (salvagedValue) {
                    // Update devcoschedules
                    await db.collection('devcoschedules').updateOne(
                        { _id: schedule._id },
                        { $set: { 'djt.createdBy': salvagedValue } }
                    );
                    
                    // Update dailyjobtickets so it's consistent
                    await db.collection('dailyjobtickets').updateOne(
                        { _id: standaloneDJT._id },
                        { $set: { createdBy: salvagedValue } }
                    );
                }
            } else {
                results.push({
                    scheduleId: schedule._id,
                    djtId: schedule.djt._id,
                    error: "Could not find matching standalone DJT"
                });
            }
        }

        return NextResponse.json({ success: true, updatedCount: results.length, debugInfo: results });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
