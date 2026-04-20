import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://adeel_db_user:Z8jNQ2cnWAdAmUFI@cluster0.kvjvx8x.mongodb.net/devco";

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error("No database connection");
    }

    // Find all schedules that have a DJT, where the DJT's createdBy is missing or empty
    const schedules = await db.collection('devcoschedules').find({
        $or: [
            { 'djt': { $exists: true, $ne: null }, 'djt.createdBy': { $in: [null, '', undefined] } },
            // Also fetch ones where 'djt' is embedded just to guarantee consistency
        ]
    }).toArray();

    console.log(`Found ${schedules.length} schedules with embedded DJTs to verify...`);

    let updatedCount = 0;

    for (const schedule of schedules) {
        if (!schedule.djt || !schedule.djt._id) continue;

        // Try to find the standalone DJT
        const standaloneDJT = await db.collection('dailyjobtickets').findOne({ _id: schedule.djt._id });
        
        if (standaloneDJT && standaloneDJT.createdBy) {
            // Need to update devcoschedules
            if (schedule.djt.createdBy !== standaloneDJT.createdBy) {
                console.log(`Updating Schedule ${schedule._id} DJT createdBy to: ${standaloneDJT.createdBy}`);
                await db.collection('devcoschedules').updateOne(
                    { _id: schedule._id },
                    { $set: { 'djt.createdBy': standaloneDJT.createdBy } }
                );
                updatedCount++;
            }
        } else if (standaloneDJT && (!standaloneDJT.createdBy || standaloneDJT.createdBy === '')) {
            // What if both are empty? Does the schedule have a projectManager or something as fallback that we could use?
            // The user just explicitly asked: "update all empty createdBy in devcoschedules.djt.createdBy from dailyjobtickets.createdBy"
            // So we only update if dailyjobtickets HAS a createdBy! Wait, if it's empty in both, maybe we should fix dailyjobtickets?
            // "so why it did not captured the createdBy in devcoschedules.djt?"
            // "update all empty createdBy in devcoschedules.djt.createdBy from dailyjobtickets.createdBy"
        }
    }

    console.log(`Migration Complete. Updated ${updatedCount} schedules.`);
    await mongoose.disconnect();
}

run().catch(console.error);
