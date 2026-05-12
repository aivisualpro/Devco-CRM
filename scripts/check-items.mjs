/**
 * Diagnostic: Check what values the `item` field has across all schedules
 * Run:  node scripts/check-items.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"?(.+?)"?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
});

const MONGODB_URI = process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ No MONGODB_URI'); process.exit(1); }

async function run() {
    await mongoose.connect(MONGODB_URI);
    const col = mongoose.connection.db.collection('schedules');

    const total = await col.countDocuments({});
    console.log(`Total schedules: ${total}`);

    // Get distinct item values
    const items = await col.distinct('item');
    console.log(`\nDistinct "item" values (${items.length}):`);
    for (const val of items) {
        const count = await col.countDocuments({ item: val });
        console.log(`  "${val}" → ${count}`);
    }

    // Check how many have no item field
    const noItem = await col.countDocuments({ item: { $in: [null, undefined, ''] } });
    const missingItem = await col.countDocuments({ item: { $exists: false } });
    console.log(`\n  (null/empty): ${noItem}`);
    console.log(`  (field missing): ${missingItem}`);

    // Check isRequiredDJT/JHA current state
    const withDJT = await col.countDocuments({ isRequiredDJT: { $exists: true } });
    const withJHA = await col.countDocuments({ isRequiredJHA: { $exists: true } });
    const djtFalse = await col.countDocuments({ isRequiredDJT: false });
    const jhaFalse = await col.countDocuments({ isRequiredJHA: false });
    console.log(`\nisRequiredDJT exists: ${withDJT}, false: ${djtFalse}`);
    console.log(`isRequiredJHA exists: ${withJHA}, false: ${jhaFalse}`);

    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
