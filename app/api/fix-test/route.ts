import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';

export async function GET() {
    try {
        await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) return NextResponse.json({ success: false, error: "No DB" });

        const scheduleId = "37efd51c1fd84a547cc96441";
        
        const idObj = new mongoose.Types.ObjectId(scheduleId);
        const schedule = await db.collection('devcoschedules').findOne({ _id: idObj });

        if (!schedule) {
            return NextResponse.json({ success: false, error: "Schedule not found" });
        }

        const djt = schedule.djt;
        
        let standaloneDJT = null;
        if (djt && djt._id) {
            standaloneDJT = await db.collection('dailyjobtickets').findOne({ _id: new mongoose.Types.ObjectId(djt._id.toString()) }) || 
                            await db.collection('dailyjobtickets').findOne({ _id: djt._id.toString() as any });
        }

        let salvagedFrom = null;
        let salvagedValue = '';

        if (djt && djt.signatures && djt.signatures.length > 0 && djt.signatures[0].employee) {
            salvagedFrom = 'schedule.djt.signatures';
            salvagedValue = djt.signatures[0].employee;
        } else if (schedule.DJTSignatures && schedule.DJTSignatures.length > 0 && schedule.DJTSignatures[0].employee) {
            salvagedFrom = 'schedule.DJTSignatures';
            salvagedValue = schedule.DJTSignatures[0].employee;
        } else if (standaloneDJT && standaloneDJT.signatures && standaloneDJT.signatures.length > 0 && standaloneDJT.signatures[0].employee) {
            salvagedFrom = 'standalone.signatures';
            salvagedValue = standaloneDJT.signatures[0].employee;
        } else if (schedule.createdBy && schedule.createdBy !== '') {
            salvagedFrom = 'schedule.createdBy';
            salvagedValue = schedule.createdBy;
        }

        const output = {
            success: true,
            salvagedValue,
            salvagedFrom,
            scheduleDjtCreatedBy: djt ? djt.createdBy : null,
            scheduleCreatedBy: schedule.createdBy,
            djtSignatures: djt ? djt.signatures : 'no djt',
            scheduleDJTSigs: schedule.DJTSignatures,
            standalone: standaloneDJT ? { createdBy: standaloneDJT.createdBy, signatures: standaloneDJT.signatures } : null
        };

        const fs = require('fs');
        fs.writeFileSync('debug-djt.json', JSON.stringify(output, null, 2));

        return NextResponse.json(output);

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
