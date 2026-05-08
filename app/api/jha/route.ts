import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { JHA, Schedule, Notification, Employee } from '@/lib/models';
import { v2 as cloudinary } from 'cloudinary';
import { Resend } from 'resend';
import mongoose from 'mongoose';
import { getWeekIdFromDate } from '@/lib/scheduleUtils';
import { revalidateTag } from 'next/cache';

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
                const { schedule_id, employee, signature, createdBy, location: rawLocation } = payload;
                // Sanitize: frontend sometimes passes window.location object instead of string
                const location = typeof rawLocation === 'object' && rawLocation?.href ? rawLocation.href : (rawLocation || '');
                
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

                // 2. Build signature document
                const newId = new mongoose.Types.ObjectId().toString();
                const sigDoc = {
                    _id: newId,
                    schedule_id,
                    employee,
                    signature: signatureUrl,
                    createdBy,
                    location,
                    createdAt: new Date()
                };

                // 3. Push signature into JHA record (SINGLE SOURCE OF TRUTH)
                await JHA.findOneAndUpdate(
                    { schedule_id },
                    { $push: { signatures: sigDoc } }
                );


                if (sigDoc.createdAt) {
                    revalidateTag(`dashboard-${getWeekIdFromDate(sigDoc.createdAt)}`, undefined as any);
                }

                return NextResponse.json({ success: true, result: sigDoc });
            }

            case 'saveJHA': {
                const jhaData = payload;
                if (!jhaData.schedule_id) return NextResponse.json({ success: false, error: 'Missing schedule_id' });

                // Remove _id and non-schema fields from update payload
                const { _id, signatures, scheduleRef, ...updateData } = jhaData;

                // Populate estimate + fromDate from schedule (source of truth)
                const schedRef = await Schedule.findOne({ _id: String(jhaData.schedule_id) }).select('estimate fromDate title').lean();
                if (schedRef) {
                    if ((schedRef as any).estimate) updateData.estimate = (schedRef as any).estimate;
                    if ((schedRef as any).fromDate) updateData.fromDate = (schedRef as any).fromDate;
                }

                // Upsert JHA (single source of truth)
                const result = await JHA.findOneAndUpdate(
                    { schedule_id: jhaData.schedule_id },
                    { $set: { ...updateData, jhaTime: updateData.jhaTime || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) } },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                
                // Only set hasJHA flag on schedule (lightweight — no full JHA copy)
                await Schedule.findOneAndUpdate(
                    { _id: jhaData.schedule_id },
                    { $set: { hasJHA: true } }
                );


                if (result?.date || result?.createdAt) {
                    revalidateTag(`dashboard-${getWeekIdFromDate(result.date || result.createdAt)}`, undefined as any);
                }

                // ── Background Notification & Email ──
                const scheduleTitle = (schedRef as any)?.title || 'Unknown Project';
                Promise.resolve().then(async () => {
                    if (jhaData.createdBy) {
                        try {
                            const recipientEmail = jhaData.createdBy;

                            // Look up creator's name and image from Employee
                            let creatorName = 'Someone';
                            let creatorImage = '';
                            const creatorDoc = await Employee.findOne({ email: { $regex: new RegExp(`^${recipientEmail}$`, 'i') } }).select('firstName lastName profilePicture image').lean() as any;
                            if (creatorDoc) {
                                creatorName = `${creatorDoc.firstName || ''} ${creatorDoc.lastName || ''}`.trim() || 'Someone';
                                creatorImage = creatorDoc.profilePicture || creatorDoc.image || '';
                            }
                            
                            // 1. Bell Notification
                            await Notification.create({
                                recipientEmail,
                                type: 'jha_created',
                                title: 'JHA Created',
                                message: `${creatorName} submitted a Job Hazard Analysis for ${scheduleTitle}.`,
                                link: `/jobs/schedules?schedule=${jhaData.schedule_id}`,
                                metadata: { creatorName, creatorImage },
                                createdBy: recipientEmail,
                                createdAt: new Date()
                            });

                            // 2. Email Notification
                            if (process.env.RESEND_API_KEY) {
                                const resendClient = new Resend(process.env.RESEND_API_KEY);
                                await resendClient.emails.send({
                                    from: 'Devco CRM <info@devco.email>',
                                    to: recipientEmail,
                                    subject: `JHA Created: ${scheduleTitle}`,
                                    html: `
                                        <div style="font-family: sans-serif; color: #333;">
                                            <h2>Job Hazard Analysis Created</h2>
                                            <p>A new JHA has been successfully created/updated.</p>
                                            <p><strong>Project/Schedule:</strong> ${scheduleTitle}</p>
                                            <p><strong>Submitted By:</strong> ${recipientEmail}</p>
                                            <br/>
                                            <p>Log in to your DEVCO CRM dashboard to view the details.</p>
                                        </div>
                                    `
                                });
                            }
                        } catch (err) {
                            console.error('[JHA Background Notification Error]', err);
                        }
                    }
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
                const { id, schedule_id } = payload;
                if (!id && !schedule_id) return NextResponse.json({ success: false, error: 'Missing ID or schedule_id' });
                
                const jha = id 
                    ? await JHA.findById(id).lean()
                    : await JHA.findOne({ schedule_id }).lean();
                if (!jha) return NextResponse.json({ success: false, error: 'Not Found' });

                // Signatures are embedded in the JHA record (single source of truth)
                const signatures = (jha as any).signatures || [];
                
                // Also fetch the schedule for context
                let scheduleDoc = null;
                if ((jha as any).schedule_id) {
                    scheduleDoc = await Schedule.findById((jha as any).schedule_id)
                        .select('_id title estimate customerId customerName fromDate toDate foremanName projectManager assignees jobLocation')
                        .lean();
                }
                
                return NextResponse.json({ success: true, jha: { ...(jha as any), signatures, scheduleRef: scheduleDoc } });
            }


            
            case 'deleteJHA': {
                const { id, schedule_id: payloadScheduleId, userId } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing ID' });
                
                // 1. Use raw driver — _id is ObjectId in DB but arrives as string
                const db = mongoose.connection.db!;
                const jhasCol = db.collection('jhas');
                const { ObjectId } = require('mongodb');
                
                // Build the _id query: try ObjectId first, fallback to string
                let idQuery: any;
                try { idQuery = new ObjectId(id); } catch { idQuery = id; }
                
                // Get the JHA first to extract schedule_id
                const jha = await jhasCol.findOne({ _id: idQuery });
                const schedId = jha?.schedule_id || payloadScheduleId;
                
                // 2. Delete JHA
                const delResult = await jhasCol.deleteOne({ _id: idQuery });
                // Fallback: try the other type if nothing was deleted
                if (delResult.deletedCount === 0) {
                    await jhasCol.deleteOne({ _id: id as any });
                }
                
                // 3. Set hasJHA: false on Schedule using raw driver (same type issue)
                if (schedId) {
                    const schedsCol = db.collection('devcoschedules');
                    let schedQuery: any;
                    try { schedQuery = new ObjectId(String(schedId)); } catch { schedQuery = String(schedId); }
                    const flagResult = await schedsCol.updateOne({ _id: schedQuery }, { $set: { hasJHA: false } });
                    // Fallback: try string if ObjectId didn't match
                    if (flagResult.modifiedCount === 0) {
                        await schedsCol.updateOne({ _id: String(schedId) as any }, { $set: { hasJHA: false } });
                    }
                }
                

                if (jha?.date || jha?.createdAt) {
                    revalidateTag(`dashboard-${getWeekIdFromDate(jha.date || jha.createdAt)}`, undefined as any);
                }

                return NextResponse.json({ success: true });
            }

            case 'getJHAs': {
                const { page = 1, limit = 20, search = '' } = payload || {};
                const skip = (page - 1) * limit;

                // ── Shared lookup stages (used in both search and non-search paths) ──
                const lookupStages: any[] = [
                    // Schedule lookup — direct string match, no $toString needed
                    {
                        $lookup: {
                            from: 'devcoschedules',
                            localField: 'schedule_id',
                            foreignField: '_id',
                            pipeline: [
                                { $project: { 
                                    _id: 1, title: 1, estimate: 1, customerId: 1, customerName: 1,
                                    fromDate: 1, toDate: 1, foremanName: 1, projectManager: 1,
                                    assignees: 1, jobLocation: 1
                                }}
                            ],
                            as: 'scheduleDocs'
                        }
                    },
                    { $unwind: { path: '$scheduleDocs', preserveNullAndEmptyArrays: true } },
                    // Client lookup — direct string match on customerId
                    {
                        $lookup: {
                            from: 'clients',
                            localField: 'scheduleDocs.customerId',
                            foreignField: '_id',
                            pipeline: [{ $project: { name: 1 } }],
                            as: 'clientDocs'
                        }
                    },
                    { $unwind: { path: '$clientDocs', preserveNullAndEmptyArrays: true } },
                    // Computed fields
                    {
                        $addFields: {
                            computedCustomerName: { 
                                $ifNull: [
                                    '$scheduleDocs.customerName', 
                                    '$clientDocs.name',
                                    '-'
                                ] 
                            },
                        }
                    },
                ];

                // ── Shared $project (final shape for UI) ──
                const finalProject = {
                    _id: 1, date: 1, jhaTime: 1, usaNo: 1, subcontractorUSANo: 1,
                    createdBy: 1, createdAt: 1, schedule_id: 1,
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
                    signatures: { $ifNull: ['$signatures', []] },
                    scheduleRef: {
                        $mergeObjects: [
                            '$scheduleDocs',
                            { customerName: '$computedCustomerName' }
                        ]
                    }
                };

                if (!search) {
                    // FAST PATH: Get paginated IDs first, then hydrate only that page
                    const [jhaDocs, total] = await Promise.all([
                        JHA.find({}).sort({ date: -1 }).skip(skip).limit(limit).lean(),
                        JHA.countDocuments({})
                    ]);

                    if (jhaDocs.length === 0) {
                        return NextResponse.json({ success: true, result: { jhas: [], total: 0 } });
                    }

                    const pageIds = jhaDocs.map((d: any) => d._id);
                    const detailedResults = await JHA.aggregate([
                        { $match: { _id: { $in: pageIds } } },
                        { $sort: { date: -1 } },
                        ...lookupStages,
                        { $project: finalProject }
                    ]);

                    return NextResponse.json({ success: true, result: { jhas: detailedResults, total } });

                } else {
                    // SEARCH PATH: lookup first then filter
                    const searchRegex = { $regex: search, $options: 'i' };
                    const result = await JHA.aggregate([
                        ...lookupStages,
                        {
                            $addFields: {
                                computedEstimate: { $ifNull: ['$scheduleDocs.estimate', 'No Est'] },
                                dateStr: { $dateToString: { format: "%m/%d/%Y", date: "$date" } }
                            }
                        },
                        {
                            $match: {
                                $or: [
                                    { usaNo: searchRegex },
                                    { computedCustomerName: searchRegex },
                                    { computedEstimate: searchRegex },
                                    { dateStr: searchRegex }
                                ]
                            }
                        },
                        { $sort: { date: -1 } },
                        {
                            $facet: {
                                metadata: [{ $count: "total" }],
                                data: [
                                    { $skip: skip },
                                    { $limit: limit },
                                    { $project: finalProject }
                                ]
                            }
                        }
                    ]).allowDiskUse(true);

                    const data = result[0].data;
                    const total = result[0].metadata[0]?.total || 0;
                    return NextResponse.json({ success: true, result: { jhas: data, total } });
                }
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('JHA API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
