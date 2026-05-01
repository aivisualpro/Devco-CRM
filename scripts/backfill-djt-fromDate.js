/**
 * Backfill: Add `fromDate` field to all dailyjobtickets
 * by looking up schedule_id → devcoschedules.fromDate
 *
 * Usage:
 *   node scripts/backfill-djt-fromDate.js          # Dry run
 *   node scripts/backfill-djt-fromDate.js --execute # Actually write
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

        const allDjts = await djtColl.find({}, { projection: { _id: 1, schedule_id: 1, fromDate: 1 } }).toArray();
        console.log(`Total DJTs: ${allDjts.length}`);

        const scheduleIds = [...new Set(allDjts.map(d => d.schedule_id).filter(Boolean))];
        const schedules = await schedColl.find(
            { _id: { $in: scheduleIds } },
            { projection: { _id: 1, fromDate: 1 } }
        ).toArray();

        const schedMap = new Map(schedules.map(s => [String(s._id), s.fromDate || null]));
        console.log(`Schedules found: ${schedules.length}`);

        let updated = 0, skipped = 0, noSchedule = 0, alreadyHas = 0;
        const bulkOps = [];

        for (const djt of allDjts) {
            if (!djt.schedule_id) { skipped++; continue; }

            const fromDate = schedMap.get(String(djt.schedule_id));
            if (fromDate === undefined) { noSchedule++; continue; }

            // Skip if already has the same fromDate
            if (djt.fromDate && fromDate && new Date(djt.fromDate).getTime() === new Date(fromDate).getTime()) {
                alreadyHas++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: djt._id },
                    update: { $set: { fromDate: fromDate } }
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
            console.log('   node scripts/backfill-djt-fromDate.js --execute');
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
