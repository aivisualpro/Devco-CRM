
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

                const ops = records.map((item: any) => {
                    const { recordId, _id, ...rest } = item;
                    const idToUse = recordId || _id || new mongoose.Types.ObjectId().toString();

                    // Ensure date is valid for createdAt if it comes from CSV
                    if (rest.createdAt) rest.createdAt = new Date(rest.createdAt);
                    
                    return {
                        updateOne: {
                            filter: { _id: idToUse },
                            update: {
                                $set: { ...rest, _id: idToUse },
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                const result = await DailyJobTicket.bulkWrite(ops);

                // SYNC TO SCHEDULES: Embed DJT record as a single object into the linked Schedule document
                const scheduleOps = records.map((item: any) => {
                     const { recordId, _id, ...rest } = item;
                     const idToUse = recordId || _id;
                     if (!rest.schedule_id) return null;
                     
                     if (rest.createdAt) rest.createdAt = new Date(rest.createdAt);

                     return {
                        updateOne: {
                            filter: { _id: rest.schedule_id },
                            update: {
                                $set: { djt: { ...rest, _id: idToUse } }
                            }
                        }
                     };
                }).filter(Boolean);

                if (scheduleOps.length > 0) {
                    await Schedule.bulkWrite(scheduleOps as any);
                }

                return NextResponse.json({ success: true, result });
            }

            case 'importDJTSignatures': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid DJT signatures array' });

                const ops = records.map((item: any) => {
                    const { recordId, _id, ...rest } = item;
                    const idToUse = recordId || _id || new mongoose.Types.ObjectId().toString();

                    if (rest.createdAt) rest.createdAt = new Date(rest.createdAt);
                    
                    return {
                        updateOne: {
                            filter: { _id: idToUse },
                            update: {
                                $set: { ...rest, _id: idToUse },
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                const result = await DJTSignature.bulkWrite(ops);

                // Group by schedule_id to update schedules
                const bySchedule: Record<string, any[]> = {};
                for (const item of records) {
                    if (item.schedule_id) {
                        if (!bySchedule[item.schedule_id]) bySchedule[item.schedule_id] = [];
                        bySchedule[item.schedule_id].push(item);
                    }
                }

                const scheduleOps = Object.entries(bySchedule).map(([schedule_id, sigs]) => {
                    return {
                        updateOne: {
                            filter: { _id: schedule_id },
                            update: {
                                $set: { DJTSignatures: sigs }
                            }
                        }
                    };
                });

                if (scheduleOps.length > 0) {
                    await Schedule.bulkWrite(scheduleOps as any);
                }

                return NextResponse.json({ success: true, result });
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
