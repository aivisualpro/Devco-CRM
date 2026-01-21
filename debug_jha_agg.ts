
import 'dotenv/config';
import mongoose from 'mongoose';
import { JHA, Schedule } from './lib/models';
import { connectToDatabase } from './lib/db';

// dotenv.config({ path: ".env.local" }); (Removed, using import 'dotenv/config')

(async () => {
    await connectToDatabase();
    
    console.log("Connected to DB");

    // 1. Get a sample JHA
    const jha = await JHA.findOne({}).sort({date: -1}).lean();
    if (!jha) {
        console.log("No JHA found.");
        process.exit();
    }
    console.log("\n--- Sample JHA ---");
    console.log("ID:", jha._id);
    console.log("Schedule ID:", jha.schedule_id);
    console.log("Type of Schedule ID:", typeof jha.schedule_id);

    // 2. Check if Schedule exists directly
    if (jha.schedule_id) {
        // Try precise match
        let sched = await Schedule.findById(jha.schedule_id).lean();
        console.log("\n--- Direct Schedule Find ---");
        if (sched) {
            console.log("Found Schedule:", sched._id);
            console.log("Schedule ID Length:", String(sched._id).length);
            console.log("JHA Schedule ID Length:", String(jha.schedule_id).length);
            console.log("Estimate:", sched.estimate);
            console.log("Customer Name from Sched:", sched.customerName);
            console.log("Customer ID:", sched.customerId);
        } else {
            console.log("Schedule NOT found directly with ID:", jha.schedule_id);
            
            // Try formatting id
            try {
                // If it's a string that looks like ObjectId
                if (typeof jha.schedule_id === 'string' && jha.schedule_id.length === 24) {
                    const asObjectId = new mongoose.Types.ObjectId(jha.schedule_id);
                    const sched2 = await Schedule.findById(asObjectId).lean();
                    console.log("Found Schedule via ObjectId cast:", !!sched2);
                }
            } catch(e) {
                console.log("Could not cast to ObjectId");
            }
        }
    }

    // 3. Run the Aggregation Pipeline
    const pipeline = [
        { $match: { _id: jha._id } }, 
        {
            $lookup: {
                from: 'schedules',
                let: { schedId: "$schedule_id" },
                pipeline: [
                    { $match: { $expr: { $eq: [
                        { $trim: { input: { $toString: "$_id" } } }, 
                        { $trim: { input: { $toString: "$$schedId" } } }
                    ] } } }
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
        // Lookup Client
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
        // Lookup Estimate
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
                schedule_id: 1,
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
        }
    ];

    console.log("\n--- Aggregation Execution ---");
    const results = await JHA.aggregate(pipeline);
    if (results.length > 0) {
        const res = results[0];
        console.log("Result _id:", res._id);
        console.log("Result schedule_id:", res.schedule_id);
        
        console.log("Result scheduleRef exists:", !!res.scheduleRef);
        console.log("Result scheduleRef is empty object?", Object.keys(res.scheduleRef || {}).length === 0);
        
        console.log("Result scheduleRef.estimate:", res.scheduleRef?.estimate);
        console.log("Result scheduleRef.customerName:", res.scheduleRef?.customerName);
        console.log("Raw scheduleDocs found?", !!res.scheduleRef?._id);
    } else {
        console.log("No results from aggregation");
    }

    process.exit();
})();
