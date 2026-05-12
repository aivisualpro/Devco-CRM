/**
 * Migration: Set isRequiredDJT=false & isRequiredJHA=false
 * for all "Day Off" schedules
 *
 * Run:  node scripts/migrate-dayoff-isRequired.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
});

const MONGODB_URI = process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ No MONGODB_URI'); process.exit(1); }

async function run() {
    console.log('🔗 Connecting...');
    await mongoose.connect(MONGODB_URI);

    const col = mongoose.connection.db.collection('devcoschedules');

    const result = await col.updateMany(
        { item: 'Day Off' },
        { $set: { isRequiredDJT: false, isRequiredJHA: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} "Day Off" schedules (matched: ${result.matchedCount})`);
    await mongoose.disconnect();
    console.log('Done!');
}

run().catch(err => { console.error('❌', err); process.exit(1); });
