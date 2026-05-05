/**
 * fix-hasDJT.js
 * 
 * Scans DailyJobTickets collection, finds all schedule_ids that have a DJT,
 * then checks which matching schedules are missing hasDJT: true.
 * 
 * Mode 1 (default): DRY RUN — just reports mismatches
 * Mode 2: pass --fix flag to actually update them
 * 
 * Usage:
 *   node scripts/fix-hasDJT.js          # dry run
 *   node scripts/fix-hasDJT.js --fix    # apply fix
 */

const mongoose = require('mongoose');
const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ No MONGODB_URI found in .env.local');
    process.exit(1);
}

const FIX_MODE = process.argv.includes('--fix');

async function main() {
    console.log(`🔌 Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected\n`);

    const db = mongoose.connection.db;
    const djtCol = db.collection('dailyjobtickets');
    const schedCol = db.collection('devcoschedules');

    // 1. Get all unique schedule_ids from DailyJobTickets
    console.log('📋 Fetching all DJT schedule_ids...');
    const djtScheduleIds = await djtCol.distinct('schedule_id');
    console.log(`   Found ${djtScheduleIds.length} unique schedule_ids in DailyJobTickets\n`);

    // 2. Find schedules that have a DJT but hasDJT is NOT true
    console.log('🔍 Checking for schedules missing hasDJT: true...');
    const mismatched = await schedCol.find({
        _id: { $in: djtScheduleIds },
        $or: [
            { hasDJT: { $ne: true } },
            { hasDJT: { $exists: false } }
        ]
    }).project({ _id: 1, title: 1, estimate: 1, hasDJT: 1, fromDate: 1 }).toArray();

    console.log(`   Found ${mismatched.length} schedules with DJTs but hasDJT ≠ true\n`);

    if (mismatched.length === 0) {
        console.log('✅ All schedules with DJTs already have hasDJT: true. Nothing to fix!');
        await mongoose.disconnect();
        return;
    }

    // 3. Print the mismatched records
    console.log('──────────────────────────────────────────────────');
    mismatched.forEach((s, i) => {
        const date = s.fromDate ? new Date(s.fromDate).toLocaleDateString() : 'N/A';
        console.log(`  ${i + 1}. ID: ${s._id} | Est: ${s.estimate || '-'} | Title: ${s.title || '-'} | Date: ${date} | hasDJT: ${s.hasDJT ?? 'undefined'}`);
    });
    console.log('──────────────────────────────────────────────────\n');

    // 4. Fix if --fix flag is passed
    if (FIX_MODE) {
        console.log('🔧 Applying fix: setting hasDJT = true...');
        const ids = mismatched.map(s => s._id);
        const result = await schedCol.updateMany(
            { _id: { $in: ids } },
            { $set: { hasDJT: true } }
        );
        console.log(`✅ Updated ${result.modifiedCount} schedules.\n`);
    } else {
        console.log('ℹ️  DRY RUN — no changes made. Run with --fix to apply:\n');
        console.log('   node scripts/fix-hasDJT.js --fix\n');
    }

    // 5. Also check reverse: hasJHA for JHAs
    console.log('── Bonus: Checking hasJHA mismatches ──');
    const jhaCol = db.collection('jhas');
    const jhaScheduleIds = await jhaCol.distinct('schedule_id');
    console.log(`   Found ${jhaScheduleIds.length} unique schedule_ids in JHAs`);

    const jhasMismatched = await schedCol.find({
        _id: { $in: jhaScheduleIds },
        $or: [
            { hasJHA: { $ne: true } },
            { hasJHA: { $exists: false } }
        ]
    }).project({ _id: 1, title: 1, estimate: 1, hasJHA: 1 }).toArray();

    console.log(`   Found ${jhasMismatched.length} schedules with JHAs but hasJHA ≠ true`);

    if (jhasMismatched.length > 0 && FIX_MODE) {
        const jhaIds = jhasMismatched.map(s => s._id);
        const jhaResult = await schedCol.updateMany(
            { _id: { $in: jhaIds } },
            { $set: { hasJHA: true } }
        );
        console.log(`✅ Updated ${jhaResult.modifiedCount} schedules with hasJHA = true.`);
    } else if (jhasMismatched.length > 0) {
        console.log('   (will also fix with --fix flag)');
    }

    console.log('\n🏁 Done.');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
