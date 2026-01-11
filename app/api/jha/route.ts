import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { JHA, Schedule, JHASignature, Activity } from '@/lib/models';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;
        
        await connectToDatabase();

        switch (action) {
            case 'saveJHASignature': {
                const { schedule_id, employee, signature, createdBy, location } = payload;
                
                if (!schedule_id || !signature) {
                    return NextResponse.json({ success: false, error: 'Missing required signature fields' });
                }

                // 1. Upload to Cloudinary
                let signatureUrl = signature;
                if (signature.startsWith('data:image')) {
                    const uploadRes = await cloudinary.uploader.upload(signature, {
                        folder: 'jha_signatures',
                        resource_type: 'image'
                    });
                    signatureUrl = uploadRes.secure_url;
                }

                // 2. Create JHASignature Record
                // Generate ID explicitly because schema defines _id as String without default
                const newId = new mongoose.Types.ObjectId().toString();
                
                const newSig = await JHASignature.create({
                    _id: newId,
                    schedule_id,
                    employee, // Email
                    signature: signatureUrl,
                    createdBy,
                    location,
                    createdAt: new Date()
                });

                // 3. Update Schedule with embedded signature object
                // We fetch the schedule first to ensure we aren't overwriting blindly? 
                // Currently Schedule.JHASignatures is an array of objects (from import logic).
                // We should push this new signature to that array.
                
                await Schedule.findOneAndUpdate(
                    { _id: schedule_id }, 
                    { 
                        $push: { 
                            JHASignatures: {
                                _id: newSig._id,
                                schedule_id,
                                employee,
                                signature: signatureUrl,
                                createdBy,
                                location,
                                createdAt: new Date()
                            }
                        } 
                    }
                );

                // 4. Log Activity
                const activityId = new mongoose.Types.ObjectId().toString();
                await Activity.create({
                    _id: activityId,
                    user: createdBy || employee,
                    action: 'signed_jha',
                    type: 'jha',
                    title: `Signed JHA for schedule`,
                    entityId: schedule_id,
                    metadata: { employee, location },
                    createdAt: new Date()
                });

                return NextResponse.json({ success: true, result: newSig });
            }

            case 'saveJHA': {
                const jhaData = payload;
                if (!jhaData.schedule_id) return NextResponse.json({ success: false, error: 'Missing schedule_id' });

                // Remove _id from update payload (MongoDB immutable field)
                const { _id, signatures, scheduleRef, ...updateData } = jhaData;

                // Update or Insert JHA
                // Using upsert based on schedule_id
                const result = await JHA.findOneAndUpdate(
                    { schedule_id: jhaData.schedule_id },
                    { $set: { ...updateData, jhaTime: updateData.jhaTime || new Date().toLocaleTimeString('en-US', { hour12: false }) } },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                
                // Also update the Schedule to point to this JHA and set hasJHA = true (implicit via having jha object)
                // We store the full JHA object on the schedule for quick access if that's the pattern
                await Schedule.findOneAndUpdate(
                    { _id: jhaData.schedule_id },
                    { $set: { jha: result } }
                );

                // Log Activity
                const activityId = new mongoose.Types.ObjectId().toString();
                await Activity.create({
                    _id: activityId,
                    user: jhaData.createdBy || 'system',
                    action: 'created_jha',
                    type: 'jha',
                    title: `Created/Updated JHA`,
                    entityId: jhaData.schedule_id,
                    metadata: { schedule_id: jhaData.schedule_id },
                    createdAt: new Date()
                });

                return NextResponse.json({ success: true, result });
            }

            case 'importJHA': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid JHA records array' });

                const ops = records.map((item: any) => {
                    // Extract recordId to use as _id if available, delete from item payload so it doesn't fail schema validation
                    // Assuming columns map directly to JHA fields
                    const { recordId, _id, ...rest } = item;
                    const idToUse = recordId || _id;

                    // Convert boolean fields from strings like TRUE/FALSE or Yes/No if CSV parser didn't
                    const convertBool = (val: any) => {
                        if (typeof val === 'boolean') return val;
                        if (typeof val === 'string') {
                            const v = val.toLowerCase().trim();
                            return v === 'true' || v === 'yes' || v === '1';
                        }
                        return false; // Default to false
                    };
                    
                    const booleanFields = [
                         'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                         'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                         'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                         'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                         'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                         'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                         'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
                    ];

                    booleanFields.forEach(field => {
                        if (rest[field] !== undefined) rest[field] = convertBool(rest[field]);
                    });

                    // Ensure date is valid
                    if (rest.date) rest.date = new Date(rest.date);
                    
                    if (idToUse) {
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
                    } else {
                         // Insert if no ID
                         return {
                             insertOne: {
                                 document: { ...rest, createdAt: new Date() }
                             }
                         }
                    }
                });

                const result = await JHA.bulkWrite(ops);

                // SYNC TO SCHEDULES: Embed JHA record as a single object into the linked Schedule document
                const scheduleOps = records.map((item: any) => {
                     const { recordId, _id, ...rest } = item;
                     const idToUse = recordId || _id;
                     if (!rest.schedule_id) return null;
                     
                     // Re-convert for consistency
                     const convertBool = (val: any) => {
                         if (typeof val === 'boolean') return val;
                         if (typeof val === 'string') {
                             const v = val.toLowerCase().trim();
                             return v === 'true' || v === 'yes' || v === '1';
                         }
                         return false; 
                    };
                    const booleanFields = [
                          'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                          'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                          'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                          'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                          'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                          'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                          'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
                     ];
                     booleanFields.forEach(field => {
                         if (rest[field] !== undefined) rest[field] = convertBool(rest[field]);
                     });
                     if (rest.date) rest.date = new Date(rest.date);

                     return {
                        updateOne: {
                            filter: { _id: rest.schedule_id },
                            update: {
                                $set: { jha: { ...rest, _id: idToUse } }
                            }
                        }
                     };
                }).filter(Boolean);

                if (scheduleOps.length > 0) {
                    await Schedule.bulkWrite(scheduleOps as any);
                }

                return NextResponse.json({ success: true, result });
            }

            case 'getJHA': {
                const { id } = payload;
                if (!id) return NextResponse.json({ success: false, error: 'Missing ID' });
                const jha = await JHA.findById(id);
                if (!jha) return NextResponse.json({ success: false, error: 'Not Found' });

                const signatures = await JHASignature.find({ schedule_id: jha.schedule_id });
                return NextResponse.json({ success: true, jha: { ...jha.toObject(), signatures } });
            }

            case 'importJHASignatures': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid JHA Signature records array' });

                // 1. Bulk Upsert into JHASignature collection (optional but good for backup/audit)
                const signatureOps = records.map((item: any) => {
                     const { recordId, _id, ...rest } = item;
                     const idToUse = recordId || _id;

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
                
                await JHASignature.bulkWrite(signatureOps);

                // 2. Sync to Schedule: Embed into JHASignatures array
                // Strategy: Pull existing signature by ID (to update) then Push new version
                const schedulePullOps = records.map((item: any) => {
                     if (!item.schedule_id) return null;
                     const { recordId, _id } = item;
                     const idToUse = recordId || _id;
                     
                     return {
                        updateOne: {
                            filter: { _id: item.schedule_id },
                            update: {
                                $pull: { JHASignatures: { _id: idToUse } }
                            }
                        }
                     };
                }).filter(Boolean);

                const schedulePushOps = records.map((item: any) => {
                     const { recordId, _id, ...rest } = item;
                     const idToUse = recordId || _id;
                     if (!rest.schedule_id) return null;
                     
                     const sigPayload = { ...rest, _id: idToUse };
                     
                     return {
                        updateOne: {
                            filter: { _id: rest.schedule_id },
                            update: {
                                $push: { JHASignatures: sigPayload }
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
            
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('JHA API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
