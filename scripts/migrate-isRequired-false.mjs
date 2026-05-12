/**
 * Migration: Set isRequiredDJT=false & isRequiredJHA=false
 * for all schedules where item ≠ "Day Off"
 *
 * Run:  node scripts/migrate-isRequired-false.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Load .env.local manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
});

const MONGODB_URI = process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ No MONGODB_URI found'); process.exit(1); }

console.log('🔗 URI database:', MONGODB_URI.split('/').pop()?.split('?')[0]);

async function run() {
    console.log('🔗 Connecting...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to:', mongoose.connection.db.databaseName);

    // List collections to verify
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📂 Collections:', collections.map(c => c.name).join(', '));

    const col = mongoose.connection.db.collection('devcoschedules');
    const total = await col.countDocuments({});
    console.log(`📊 Total schedules: ${total}`);

    if (total === 0) {
        console.log('⚠️  No schedules found. Check database name.');
        await mongoose.disconnect();
        return;
    }

    // Show sample item values
    const sample = await col.find({}, { projection: { item: 1 } }).limit(5).toArray();
    console.log('Sample items:', sample.map(s => s.item));

    const count = await col.countDocuments({ item: { $ne: 'Day Off' } });
    console.log(`\n🎯 ${count} schedules where item ≠ "Day Off"`);

    const result = await col.updateMany(
        { item: { $ne: 'Day Off' } },
        { $set: { isRequiredDJT: true, isRequiredJHA: true } }
    );

    console.log(`✅ Updated ${result.modifiedCount} schedules → isRequiredDJT=true, isRequiredJHA=true`);
    await mongoose.disconnect();
    console.log('Done!');
}

run().catch(err => { console.error('❌', err); process.exit(1); });
