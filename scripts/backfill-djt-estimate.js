/**
 * Backfill: Add `estimate` field to all dailyjobtickets
 * by looking up schedule_id → devcoschedules.estimate
 *
 * Usage:
 *   node scripts/backfill-djt-estimate.js          # Dry run
 *   node scripts/backfill-djt-estimate.js --execute # Actually write
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not found'); process.exit(1); }

const DRY_RUN = !process.argv.includes('--execute');

async function main() {
    try {
        await mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
            family: 4,
        });
        console.log('✅ Connected to MongoDB');
        console.log(DRY_RUN ? '🔍 DRY RUN MODE\n' : '⚡ EXECUTE MODE\n');

        const db = mongoose.connection.db;
        const djtColl = db.collection('dailyjobtickets');
        const schedColl = db.collection('devcoschedules');

        // 1. Get all DJTs
        const allDjts = await djtColl.find({}, { projection: { _id: 1, schedule_id: 1, estimate: 1 } }).toArray();
        console.log(`Total DJTs: ${allDjts.length}`);

        // 2. Collect unique schedule_ids
        const scheduleIds = [...new Set(allDjts.map(d => d.schedule_id).filter(Boolean))];
        console.log(`Unique schedule_ids: ${scheduleIds.length}`);

        // 3. Fetch all schedules with estimate field
        const schedules = await schedColl.find(
            { _id: { $in: scheduleIds } },
            { projection: { _id: 1, estimate: 1 } }
        ).toArray();

        const schedMap = new Map(schedules.map(s => [String(s._id), s.estimate || '']));
        console.log(`Schedules found: ${schedules.length}`);

        // 4. Build bulk updates
        let updated = 0;
        let skipped = 0;
        let noSchedule = 0;
        let alreadyHas = 0;
        const bulkOps = [];

        for (const djt of allDjts) {
            if (!djt.schedule_id) {
                skipped++;
                continue;
            }

            const estimate = schedMap.get(String(djt.schedule_id));

            if (estimate === undefined) {
                noSchedule++;
                continue;
            }

            // Skip if already has the correct estimate
            if (djt.estimate === estimate) {
                alreadyHas++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: djt._id },
                    update: { $set: { estimate: estimate } }
                }
            });
            updated++;
        }

        console.log(`\n═══════════════════════════════════════`);
        console.log(`  Will update:      ${updated}`);
        console.log(`  Already correct:  ${alreadyHas}`);
        console.log(`  No schedule_id:   ${skipped}`);
        console.log(`  Schedule missing: ${noSchedule}`);
        console.log(`═══════════════════════════════════════\n`);

        if (!DRY_RUN && bulkOps.length > 0) {
            const result = await djtColl.bulkWrite(bulkOps);
            console.log(`✅ Updated ${result.modifiedCount} documents`);
        } else if (DRY_RUN) {
            console.log('🔍 Dry run complete. To execute:');
            console.log('   node scripts/backfill-djt-estimate.js --execute');
        } else {
            console.log('✅ Nothing to update');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
