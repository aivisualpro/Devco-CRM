
// This line is a placeholder action. I will instead use npx tsx to run the previous file.

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
        const sched = await Schedule.findById(jha.schedule_id).lean();
        console.log("\n--- Direct Schedule Find ---");
        if (sched) {
            console.log("Found Schedule:", sched._id);
            console.log("Type of Schedule _id:", typeof sched._id);
            console.log("Estimate:", sched.estimate);
            console.log("Customer ID:", sched.customerId);
        } else {
            console.log("Schedule NOT found directy with ID:", jha.schedule_id);
            
            // Try formatting id
            try {
                const asObjectId = new mongoose.Types.ObjectId(jha.schedule_id);
                const sched2 = await Schedule.findById(asObjectId).lean();
                 console.log("Found Schedule via ObjectId cast:", !!sched2);
            } catch(e) {
                console.log("Could not cast to ObjectId");
            }
        }
    }

    // 3. Run the Aggregation Pipeline
    const pipeline = [
        { $match: { _id: jha._id } }, // Validating on this specific one
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
        console.log("Result scheduleRef keys:", Object.keys(res.scheduleRef || {}));
        console.log("Result scheduleRef.estimate:", res.scheduleRef?.estimate);
        console.log("Result scheduleRef.customerName:", res.scheduleRef?.customerName);
    } else {
        console.log("No results from aggregation");
    }

    process.exit();
})();
