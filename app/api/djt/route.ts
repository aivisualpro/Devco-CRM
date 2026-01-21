
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DailyJobTicket, Schedule, Activity, DJTSignature } from '@/lib/models';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;
        
        await connectToDatabase();

        switch (action) {
            case 'importDJT': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid DJT records array' });

                // 1. Pre-process records to ensure IDs and types are correct
                const processedRecords = records.map((item: any) => {
                     const { recordId, _id, ...rest } = item;
                     // Ensure we have an ID to use: use provided or generate new
                     const idToUse = recordId || _id || new mongoose.Types.ObjectId().toString();
                     
                     // Ensure dates are dates
                     if (rest.createdAt) rest.createdAt = new Date(rest.createdAt);

                     return {
                        _id: idToUse,
                        ...rest
                     };
                });

                // 2. Bulk Upsert into DailyJobTicket collection
                const djtOps = processedRecords.map((item: any) => {
                     return {
                        updateOne: {
                            filter: { _id: item._id },
                            update: {
                                $set: item,
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                await DailyJobTicket.bulkWrite(djtOps);

                // 3. SYNC TO SCHEDULES: Embed DJT record as a single object into the linked Schedule document
                const scheduleOps = processedRecords.map((item: any) => {
                     if (!item.schedule_id) return null;
                     
                     return {
                        updateOne: {
                            filter: { _id: item.schedule_id },
                            update: {
                                $set: { djt: item }
                            }
                        }
                     };
                }).filter(Boolean);

                if (scheduleOps.length > 0) {
                    await Schedule.bulkWrite(scheduleOps as any);
                }

                return NextResponse.json({ success: true, count: records.length });
            }

            case 'importDJTSignatures': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid DJT signatures array' });

                // 1. Pre-process records to ensure IDs and types are correct
                const processedRecords = records.map((item: any) => {
                     const { recordId, _id, ...rest } = item;
                     // Ensure we have an ID to use
                     const idToUse = recordId || _id || new mongoose.Types.ObjectId().toString();
                     
                     // Ensure dates are dates
                     if (rest.createdAt) rest.createdAt = new Date(rest.createdAt);

                     return {
                        _id: idToUse,
                        ...rest
                     };
                });

                // 2. Bulk Upsert into DJTSignature collection
                const ops = processedRecords.map((item: any) => {
                    return {
                        updateOne: {
                            filter: { _id: item._id },
                            update: {
                                $set: item,
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                await DJTSignature.bulkWrite(ops);

                // 3. Sync to Schedule: Embed into DJTSignatures array
                // Strategy: Pull existing signature by ID (to remove old version if exists) then Push new version
                
                const schedulePullOps = processedRecords.map((item: any) => {
                     if (!item.schedule_id) return null;
                     
                     return {
                        updateOne: {
                            filter: { _id: item.schedule_id },
                            update: {
                                $pull: { DJTSignatures: { _id: item._id } }
                            }
                        }
                     };
                }).filter(Boolean);

                const schedulePushOps = processedRecords.map((item: any) => {
                     if (!item.schedule_id) return null;
                     
                     return {
                        updateOne: {
                            filter: { _id: item.schedule_id },
                            update: {
                                $push: { DJTSignatures: item }
                            }
                        }
                     };
                }).filter(Boolean);

                if (schedulePullOps.length > 0) {
                     await Schedule.bulkWrite(schedulePullOps as any);
                     await Schedule.bulkWrite(schedulePushOps as any);
                }

                return NextResponse.json({ success: true, count: records.length });
            }
            
            case 'saveDJTSignature': {
                const sigData = payload;
                if (!sigData.schedule_id) return NextResponse.json({ success: false, error: 'Missing schedule_id' });

                const idToUse = new mongoose.Types.ObjectId().toString();
                
                const newSig = await DJTSignature.create({
                    ...sigData,
                    _id: idToUse,
                    createdAt: new Date()
                });

                // Update the Schedule's DJTSignatures array
                await Schedule.findOneAndUpdate(
                    { _id: sigData.schedule_id },
                    { $push: { DJTSignatures: newSig } }
                );

                return NextResponse.json({ success: true, result: newSig });
            }

            case 'saveDJT': {
                const djtData = payload;
                const idToUse = djtData._id || new mongoose.Types.ObjectId().toString();
                const { _id, ...rest } = djtData;

                // 1. Upsert DailyJobTicket
                const updatedDJT = await DailyJobTicket.findOneAndUpdate(
                    { _id: idToUse },
                    { 
                        $set: { ...rest }, 
                        $setOnInsert: { createdAt: new Date() } 
                    },
                    { upsert: true, new: true }
                );

                // 2. Sync to Schedule
                // Note: The frontend might be sending schedule_id or we rely on the one in djtData
                // If it's a new DJT, we need to make sure we link it to the schedule
                if (djtData.schedule_id) {
                    await Schedule.updateOne(
                        { _id: djtData.schedule_id },
                        { $set: { djt: updatedDJT } }
                    );

                    // Log Activity
                    const activityId = new mongoose.Types.ObjectId().toString();
                    await Activity.create({
                        _id: activityId,
                        title: 'Daily Job Ticket Updated',
                        type: 'job', // Changed from 'djt' to match likely schema enum if any, or general type
                        action: 'updated',
                        entityId: idToUse,
                        user: djtData.createdBy || 'system',
                        details: `Updated Daily Job Ticket for schedule`,
                        metadata: { scheduleId: djtData.schedule_id },
                        date: new Date(), // Many schemas use date or timestamp
                        createdAt: new Date()
                    });
                }

                return NextResponse.json({ success: true, result: updatedDJT });
            }
            
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('DJT API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
