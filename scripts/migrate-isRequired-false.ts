/**
 * Migration Script: Set isRequiredDJT and isRequiredJHA to false
 * for all schedules where item !== 'Day Off'
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/migrate-isRequired-false.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ No MONGODB_URI found. Make sure .env.local is loaded.');
    process.exit(1);
}

async function run() {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!);
    console.log('✅ Connected.');

    const db = mongoose.connection.db!;
    const collection = db.collection('schedules');

    // Count how many will be affected
    const count = await collection.countDocuments({
        item: { $ne: 'Day Off' }
    });
    console.log(`📊 Found ${count} schedules where item ≠ "Day Off"`);

    // Update all non-Day Off schedules
    const result = await collection.updateMany(
        { item: { $ne: 'Day Off' } },
        { $set: { isRequiredDJT: false, isRequiredJHA: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} schedules (matched: ${result.matchedCount})`);
    console.log('   → isRequiredDJT = false');
    console.log('   → isRequiredJHA = false');

    await mongoose.disconnect();
    console.log('🔌 Disconnected. Done!');
}

run().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
