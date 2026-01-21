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

                // 1. Pre-process records to ensure IDs and types are correct
                const processedRecords = records.map((item: any) => {
                    const { recordId, _id, ...rest } = item;
                    // Ensure we have an ID to use for both JHA collection and Schedule embedding
                    const idToUse = recordId || _id || new mongoose.Types.ObjectId().toString();

                    // Convert boolean fields
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
                         'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed',
                         'anySpecificNotes' 
                    ]; // entries that are text/notes shouldn't be here, but 'anySpecificNotes' sounds like text?
                    // User list check: 'anySpecificNotes' is listed. Usually notes are strings.
                    // 'commentsOn...' are strings.
                    // 'anySpecificNotes' is likely a string. Removing it from booleanFields if it was implicitly there or just to be safe.
                    // The previous code didn't include it in booleanFields. I will check the user's list again.
                    // User: ... commentsOnOther anySpecificNotes stagingAreaDiscussed ...
                    // 'anySpecificNotes' looks like a text field. I'll NOT treat it as boolean.

                    const actualBooleanFields = [
                         'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                         'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                         'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                         'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                         'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                         'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                         'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
                    ];

                    actualBooleanFields.forEach(field => {
                        if (rest[field] !== undefined) rest[field] = convertBool(rest[field]);
                    });

                    // Ensure date is valid
                    if (rest.date) rest.date = new Date(rest.date);

                    return {
                        _id: idToUse,
                        ...rest
                    };
                });

                // 2. Prepare JHA Collection Upserts
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

                const result = await JHA.bulkWrite(ops);

                // 3. Prepare Schedule Updates (Embedding JHA)
                const scheduleOps = processedRecords.map((item: any) => {
                     if (!item.schedule_id) return null;
                     
                     return {
                        updateOne: {
                            filter: { _id: item.schedule_id },
                            update: {
                                $set: { jha: item }
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

                // 2. Bulk Upsert into JHASignature collection
                const signatureOps = processedRecords.map((item: any) => {
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
                
                await JHASignature.bulkWrite(signatureOps);

                // 3. Sync to Schedule: Embed into JHASignatures array
                // Strategy: Pull existing signature by ID (to remove old version if exists) then Push new version
                
                const schedulePullOps = processedRecords.map((item: any) => {
                     if (!item.schedule_id) return null;
                     
                     return {
                        updateOne: {
                            filter: { _id: item.schedule_id },
                            update: {
                                $pull: { JHASignatures: { _id: item._id } }
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
                                $push: { JHASignatures: item }
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
            
            case 'deleteJHA': {
                const { id, userId } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing ID' });
                
                // 1. Get JHA to find schedule_id
                const jha = await JHA.findById(id);
                if (!jha) return NextResponse.json({ success: false, error: 'JHA not found' });
                
                // 2. Delete JHA
                await JHA.findByIdAndDelete(id);
                
                // 3. Remove from Schedule
                if (jha.schedule_id) {
                    await Schedule.findByIdAndUpdate(jha.schedule_id, { 
                        $unset: { jha: 1 } 
                    });
                }
                
                // 4. Log Activity
                 const activityId = new mongoose.Types.ObjectId().toString();
                 await Activity.create({
                    _id: activityId,
                    user: userId || 'system',
                    action: 'deleted_jha',
                    type: 'jha',
                    title: `Deleted JHA`,
                    entityId: id,
                    createdAt: new Date()
                });

                return NextResponse.json({ success: true });
            }

            case 'getJHAs': {
                const pipeline = [
                    {
                        $lookup: {
                            from: 'schedules',
                            let: { schedId: "$schedule_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: [{ $toString: "$_id" }, { $toString: "$$schedId" }] } } }
                            ],
                            as: 'scheduleDocs'
                        }
                    },
                    {
                        $unwind: {
                            path: '$scheduleDocs',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    // Lookup Client to populate customerName if missing
                    {
                        $lookup: {
                            from: 'clients',
                            let: { cid: "$scheduleDocs.customerId" },
                            pipeline: [
                                { $match: { $expr: { $eq: [{ $toString: "$_id" }, { $toString: "$$cid" }] } } }
                            ],
                            as: 'clientDocs'
                        }
                    },
                    {
                        $unwind: { path: '$clientDocs', preserveNullAndEmptyArrays: true }
                    },
                    // Lookup Estimate for extra metadata
                    {
                        $lookup: {
                            from: 'estimates',
                            localField: 'scheduleDocs.estimate',
                            foreignField: 'estimate',
                            as: 'estimateDocs'
                        }
                    },
                    {
                        $unwind: { path: '$estimateDocs', preserveNullAndEmptyArrays: true }
                    },
                    {
                        $project: {
                            _id: 1, 
                            date: 1, 
                            jhaTime: 1, 
                            usaNo: 1, 
                            subcontractorUSANo: 1,
                            signatures: 1, 
                            createdBy: 1, 
                            schedule_id: 1,
                            
                            // Include all fields
                            operatingMiniEx: 1, operatingAVacuumTruck: 1, excavatingTrenching: 1, acConcWork: 1,
                            operatingBackhoe: 1, workingInATrench: 1, trafficControl: 1, roadWork: 1, operatingHdd: 1,
                            confinedSpace: 1, settingUgBoxes: 1, otherDailyWork: 1, sidewalks: 1, heatAwareness: 1,
                            ladderWork: 1, overheadLifting: 1, materialHandling: 1, roadHazards: 1, heavyLifting: 1,
                            highNoise: 1, pinchPoints: 1, sharpObjects: 1, trippingHazards: 1, otherJobsiteHazards: 1,
                            stagingAreaDiscussed: 1, rescueProceduresDiscussed: 1, evacuationRoutesDiscussed: 1,
                            emergencyContactNumberWillBe911: 1, firstAidAndCPREquipmentOnsite: 1, closestHospitalDiscussed: 1,
                            commentsOnOtherDailyWork: 1, commentsOnSidewalks: 1, commentsOnHeatAwareness: 1,
                            commentsOnLadderWork: 1, commentsOnOverheadLifting: 1, commentsOnMaterialHandling: 1,
                            commentsOnRoadHazards: 1, commentsOnHeavyLifting: 1, commentsOnHighNoise: 1,
                            commentsOnPinchPoints: 1, commentsOnSharpObjects: 1, commentsOnTrippingHazards: 1,
                            commentsOnOther: 1, anySpecificNotes: 1, nameOfHospital: 1, addressOfHospital: 1,
                            clientEmail: 1, emailCounter: 1,

                            scheduleRef: {
                                $mergeObjects: [
                                    '$scheduleDocs',
                                    { 
                                        customerName: { $ifNull: [
                                            '$scheduleDocs.customerName', 
                                            '$clientDocs.name',
                                            '$estimateDocs.customerName'
                                        ] } 
                                    }
                                ]
                            }
                        }
                    },
                    { $sort: { date: -1 } }
                ];
                
                const results = await JHA.aggregate(pipeline as any[]);
                return NextResponse.json({ success: true, result: results });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('JHA API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
