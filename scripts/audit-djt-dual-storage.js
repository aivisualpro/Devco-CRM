/**
 * DJT Dual-Storage Audit Script (READ-ONLY)
 * Uses Mongoose (same as the app) for reliable connection.
 * 
 * Usage: node scripts/audit-djt-dual-storage.js
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
}

// Fields to compare between both stores
const COMPARE_FIELDS = [
    '_id',
    'dailyJobDescription',
    'customerPrintName',
    'customerSignature',
    'createdBy',
    'clientEmail',
    'emailCounter',
    'djtCost',
    'djtTime',
];

const ARRAY_FIELDS = ['equipmentUsed', 'djtEmails', 'signatures'];

function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) {
        // Normalize empty strings, undefined, null as equivalent
        const aEmpty = a === '' || a === undefined || a === null;
        const bEmpty = b === '' || b === undefined || b === null;
        if (aEmpty && bEmpty) return true;
        return false;
    }
    if ((a === 0 && (b === undefined || b === null)) || (b === 0 && (a === undefined || a === null))) return true;
    if (typeof a !== typeof b) return String(a) === String(b);
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return JSON.stringify(a) === JSON.stringify(b);
    }
    if (typeof a === 'object') {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    return String(a) === String(b);
}

async function main() {
    try {
        await mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
            family: 4,
        });
        console.log('✅ Connected to MongoDB via Mongoose\n');

        const db = mongoose.connection.db;

        // 1. Fetch all standalone DJTs
        const collectionDjts = await db.collection('dailyjobtickets').find({}).toArray();
        console.log(`📊 dailyjobtickets collection: ${collectionDjts.length} documents`);

        // 2. Fetch all schedules that have a djt embedded object
        const schedulesWithDjt = await db.collection('devcoschedules').find(
            { djt: { $ne: null, $exists: true } },
            {
                projection: {
                    _id: 1,
                    djt: 1,
                    DJTSignatures: 1,
                    estimate: 1,
                    fromDate: 1,
                    item: 1,
                    customerName: 1
                }
            }
        ).toArray();
        console.log(`📊 devcoschedules with djt embed: ${schedulesWithDjt.length} documents`);

        // Filter out empty djt objects
        const schedulesWithRealDjt = schedulesWithDjt.filter(s => {
            if (!s.djt) return false;
            const keys = Object.keys(s.djt);
            return keys.length > 0;
        });
        console.log(`📊 devcoschedules with non-empty djt: ${schedulesWithRealDjt.length} documents`);

        const totalSchedules = await db.collection('devcoschedules').countDocuments();
        const dayOffSchedules = await db.collection('devcoschedules').countDocuments({ item: 'Day Off' });
        const nonDayOffSchedules = totalSchedules - dayOffSchedules;
        console.log(`📊 Total schedules: ${totalSchedules} (${nonDayOffSchedules} non-Day-Off, ${dayOffSchedules} Day Off)\n`);

        // Build lookup maps
        const collectionByScheduleId = new Map();
        const collectionById = new Map();
        collectionDjts.forEach(djt => {
            if (djt.schedule_id) collectionByScheduleId.set(String(djt.schedule_id), djt);
            collectionById.set(String(djt._id), djt);
        });

        const embedByScheduleId = new Map();
        schedulesWithRealDjt.forEach(s => {
            embedByScheduleId.set(String(s._id), {
                ...s.djt,
                _scheduleId: String(s._id),
                _scheduleMeta: { estimate: s.estimate, fromDate: s.fromDate, customerName: s.customerName, item: s.item },
                _DJTSignatures: s.DJTSignatures
            });
        });

        // ─── Categorize ───
        const categoryA = [];
        const categoryB = [];
        const categoryC = [];
        const categoryD = [];

        for (const [scheduleId, collDjt] of collectionByScheduleId) {
            const embedDjt = embedByScheduleId.get(scheduleId);

            if (!embedDjt) {
                categoryC.push({
                    schedule_id: scheduleId,
                    djt_id: String(collDjt._id),
                    createdBy: collDjt.createdBy,
                    createdAt: collDjt.createdAt,
                    hasDescription: !!collDjt.dailyJobDescription,
                    hasSignatures: (collDjt.signatures || []).length,
                    hasEquipment: (collDjt.equipmentUsed || []).length,
                    hasImages: (collDjt.djtimages || []).length,
                });
                continue;
            }

            const diffs = [];

            for (const field of COMPARE_FIELDS) {
                const collVal = collDjt[field];
                const embedVal = embedDjt[field];
                if (!deepEqual(collVal, embedVal)) {
                    diffs.push({
                        field,
                        collection: collVal !== undefined ? String(collVal).substring(0, 100) : '<missing>',
                        embed: embedVal !== undefined ? String(embedVal).substring(0, 100) : '<missing>',
                    });
                }
            }

            for (const field of ARRAY_FIELDS) {
                const collVal = collDjt[field] || [];
                const embedVal = embedDjt[field] || [];
                if (!deepEqual(collVal, embedVal)) {
                    diffs.push({
                        field,
                        collection: `[${collVal.length} items]`,
                        embed: `[${embedVal.length} items]`,
                    });
                }
            }

            // Check djtimages array
            const collImages = collDjt.djtimages || [];
            const embedImages = embedDjt.djtimages || [];
            if (!deepEqual(collImages, embedImages)) {
                diffs.push({
                    field: 'djtimages',
                    collection: `[${collImages.length} images]`,
                    embed: `[${embedImages.length} images]`,
                });
            }

            const embedSigs = embedDjt._DJTSignatures || [];
            const collSigs = collDjt.signatures || [];
            const sigsMismatch = embedSigs.length !== collSigs.length;

            if (diffs.length === 0 && !sigsMismatch) {
                categoryA.push({ schedule_id: scheduleId, djt_id: String(collDjt._id) });
            } else {
                categoryB.push({
                    schedule_id: scheduleId,
                    djt_id: String(collDjt._id),
                    diffs,
                    sigsMismatch: sigsMismatch ? { collection: collSigs.length, embed_DJTSignatures: embedSigs.length } : null,
                    collectionUpdatedAt: collDjt.updatedAt,
                    embedUpdatedAt: embedDjt.updatedAt,
                });
            }

            embedByScheduleId.delete(scheduleId);
        }

        // Remaining embeds are Category D
        for (const [scheduleId, embedDjt] of embedByScheduleId) {
            const matchById = embedDjt._id ? collectionById.get(String(embedDjt._id)) : null;

            categoryD.push({
                schedule_id: scheduleId,
                djt_id: embedDjt._id ? String(embedDjt._id) : '<no _id>',
                createdBy: embedDjt.createdBy,
                createdAt: embedDjt.createdAt,
                hasDescription: !!embedDjt.dailyJobDescription,
                hasSignatures: (embedDjt.signatures || []).length,
                hasEquipment: (embedDjt.equipmentUsed || []).length,
                hasImages: (embedDjt.djtimages || []).length,
                scheduleMeta: embedDjt._scheduleMeta,
                matchedInCollectionById: matchById ? String(matchById._id) : null,
            });
        }

        // ─── Report ───
        console.log('═══════════════════════════════════════════════════');
        console.log('         DJT DUAL-STORAGE AUDIT REPORT');
        console.log('═══════════════════════════════════════════════════\n');

        console.log(`✅ Category A (Both exist, data MATCHES):     ${categoryA.length}`);
        console.log(`⚠️  Category B (Both exist, data DIFFERS):     ${categoryB.length}`);
        console.log(`❌ Category C (Only in collection):            ${categoryC.length}`);
        console.log(`❌ Category D (Only in embed):                 ${categoryD.length}`);
        console.log('');

        const totalUnique = categoryA.length + categoryB.length + categoryC.length + categoryD.length;
        console.log(`📊 Total unique DJT records across both stores: ${totalUnique}`);
        console.log(`📊 Collection total: ${collectionDjts.length}`);
        console.log(`📊 Embed total (non-empty): ${schedulesWithRealDjt.length}`);
        console.log('');

        // ── Category B Details ──
        if (categoryB.length > 0) {
            console.log('───────────────────────────────────────────────────');
            console.log('⚠️  CATEGORY B — DIVERGED RECORDS');
            console.log('───────────────────────────────────────────────────');

            const fieldDivergenceCounts = {};
            categoryB.forEach(item => {
                item.diffs.forEach(d => {
                    fieldDivergenceCounts[d.field] = (fieldDivergenceCounts[d.field] || 0) + 1;
                });
                if (item.sigsMismatch) {
                    fieldDivergenceCounts['DJTSignatures_vs_signatures'] = (fieldDivergenceCounts['DJTSignatures_vs_signatures'] || 0) + 1;
                }
            });

            console.log('\n📊 Field divergence frequency:');
            Object.entries(fieldDivergenceCounts)
                .sort(([, a], [, b]) => b - a)
                .forEach(([field, count]) => {
                    console.log(`   ${field}: ${count} records differ`);
                });

            console.log(`\n📋 Showing first ${Math.min(20, categoryB.length)} of ${categoryB.length}:`);
            categoryB.slice(0, 20).forEach((item, i) => {
                console.log(`\n  [${i + 1}] schedule_id: ${item.schedule_id} | djt_id: ${item.djt_id}`);
                console.log(`      Collection updated: ${item.collectionUpdatedAt || 'N/A'}`);
                console.log(`      Embed updated: ${item.embedUpdatedAt || 'N/A'}`);
                item.diffs.forEach(d => {
                    console.log(`      📌 ${d.field}:`);
                    console.log(`         Collection: ${d.collection}`);
                    console.log(`         Embed:      ${d.embed}`);
                });
                if (item.sigsMismatch) {
                    console.log(`      📌 Signatures count mismatch:`);
                    console.log(`         Collection.signatures: ${item.sigsMismatch.collection}`);
                    console.log(`         Schedule.DJTSignatures: ${item.sigsMismatch.embed_DJTSignatures}`);
                }
            });
            console.log('');
        }

        // ── Category C Details ──
        if (categoryC.length > 0) {
            console.log('───────────────────────────────────────────────────');
            console.log(`❌ CATEGORY C — ONLY IN COLLECTION (${categoryC.length} total, showing first 10)`);
            console.log('───────────────────────────────────────────────────');
            categoryC.slice(0, 10).forEach((item, i) => {
                console.log(`  [${i + 1}] schedule_id: ${item.schedule_id} | djt_id: ${item.djt_id}`);
                console.log(`      Created by: ${item.createdBy} | Created at: ${item.createdAt}`);
                console.log(`      Description: ${item.hasDescription ? 'Yes' : 'No'} | Sigs: ${item.hasSignatures} | Equip: ${item.hasEquipment} | Images: ${item.hasImages}`);
            });
            console.log('');
        }

        // ── Category D Details ──
        if (categoryD.length > 0) {
            console.log('───────────────────────────────────────────────────');
            console.log(`❌ CATEGORY D — ONLY IN EMBED (${categoryD.length} total, showing first 10)`);
            console.log('───────────────────────────────────────────────────');
            categoryD.slice(0, 10).forEach((item, i) => {
                console.log(`  [${i + 1}] schedule_id: ${item.schedule_id} | djt_id: ${item.djt_id}`);
                console.log(`      Created by: ${item.createdBy} | Created at: ${item.createdAt}`);
                console.log(`      Description: ${item.hasDescription ? 'Yes' : 'No'} | Sigs: ${item.hasSignatures} | Equip: ${item.hasEquipment} | Images: ${item.hasImages}`);
                console.log(`      Schedule: ${item.scheduleMeta?.estimate || 'N/A'} | ${item.scheduleMeta?.fromDate || 'N/A'} | ${item.scheduleMeta?.customerName || 'N/A'}`);
                if (item.matchedInCollectionById) {
                    console.log(`      ⚠️  FOUND in collection by _id: ${item.matchedInCollectionById} (schedule_id mismatch?)`);
                }
            });
            console.log('');
        }

        // Write JSON summary to file for programmatic access
        const fs = require('fs');
        const summary = {
            counts: {
                collection_total: collectionDjts.length,
                embed_total: schedulesWithRealDjt.length,
                total_schedules: totalSchedules,
                day_off_schedules: dayOffSchedules,
                non_day_off_schedules: nonDayOffSchedules,
            },
            categories: {
                A_both_match: categoryA.length,
                B_both_differ: categoryB.length,
                C_collection_only: categoryC.length,
                D_embed_only: categoryD.length,
            },
            categoryB_field_divergence: (() => {
                const counts = {};
                categoryB.forEach(item => {
                    item.diffs.forEach(d => { counts[d.field] = (counts[d.field] || 0) + 1; });
                    if (item.sigsMismatch) counts['DJTSignatures_vs_signatures'] = (counts['DJTSignatures_vs_signatures'] || 0) + 1;
                });
                return counts;
            })(),
            categoryB_records: categoryB.slice(0, 30),
            categoryC_records: categoryC,
            categoryD_records: categoryD,
        };
        fs.writeFileSync('/tmp/djt-audit-results.json', JSON.stringify(summary, null, 2));
        console.log('\n📁 Full results written to /tmp/djt-audit-results.json');

        console.log('═══════════════════════════════════════════════════');
        console.log('                  AUDIT COMPLETE');
        console.log('═══════════════════════════════════════════════════');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
