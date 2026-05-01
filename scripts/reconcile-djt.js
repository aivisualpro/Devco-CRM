/**
 * DJT Dual-Storage Reconciliation Script
 * 
 * SAFE: Creates backups before modifying.
 * DRY-RUN by default — pass --execute to actually write.
 * 
 * Usage:
 *   node scripts/reconcile-djt.js          # Dry run (shows what would happen)
 *   node scripts/reconcile-djt.js --execute # Actually perform the reconciliation
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const fs = require('fs');

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
        console.log(DRY_RUN ? '🔍 DRY RUN MODE — no changes will be made\n' : '⚡ EXECUTE MODE — changes will be written to DB\n');

        const db = mongoose.connection.db;
        const djtColl = db.collection('dailyjobtickets');
        const schedColl = db.collection('devcoschedules');

        // ── Step 0: Backup ──
        if (!DRY_RUN) {
            console.log('💾 Creating backups...');
            const allDjts = await djtColl.find({}).toArray();
            const allSchedulesDjt = await schedColl.find(
                { djt: { $ne: null, $exists: true } },
                { projection: { _id: 1, djt: 1, DJTSignatures: 1 } }
            ).toArray();
            
            const backupPath = `/tmp/djt-reconcile-backup-${Date.now()}.json`;
            fs.writeFileSync(backupPath, JSON.stringify({
                dailyjobtickets: allDjts,
                schedule_djt_embeds: allSchedulesDjt,
                timestamp: new Date().toISOString(),
            }, null, 2));
            console.log(`💾 Backup saved to ${backupPath}\n`);
        }

        // Fetch data
        const collectionDjts = await djtColl.find({}).toArray();
        const schedulesWithDjt = await schedColl.find(
            { djt: { $ne: null, $exists: true } },
            { projection: { _id: 1, djt: 1, DJTSignatures: 1 } }
        ).toArray();

        const collByScheduleId = new Map();
        const collById = new Map();
        collectionDjts.forEach(d => {
            if (d.schedule_id) collByScheduleId.set(String(d.schedule_id), d);
            collById.set(String(d._id), d);
        });

        const embedByScheduleId = new Map();
        schedulesWithDjt.forEach(s => {
            if (s.djt && Object.keys(s.djt).length > 0) {
                embedByScheduleId.set(String(s._id), { djt: s.djt, DJTSignatures: s.DJTSignatures || [] });
            }
        });

        let stats = {
            fix1_djtCost: 0,
            fix2_sigs_to_collection: 0,
            fix3_sigs_merged: 0,
            fix4_embed_from_collection: 0,
            fix5_collection_from_embed: 0,
            fix6_id_mismatch_fixed: 0,
            fix7_emails_synced: 0,
            errors: 0,
        };

        // ══════════════════════════════════════════════════
        // FIX 1: djtCost cosmetic — set to 0 on embed where missing
        // ══════════════════════════════════════════════════
        console.log('── FIX 1: djtCost sync (embed missing → set 0) ──');
        for (const [schedId, embedData] of embedByScheduleId) {
            const collDjt = collByScheduleId.get(schedId);
            if (!collDjt) continue;
            
            if (collDjt.djtCost !== undefined && embedData.djt.djtCost === undefined) {
                stats.fix1_djtCost++;
                if (!DRY_RUN) {
                    await schedColl.updateOne(
                        { _id: schedId },
                        { $set: { 'djt.djtCost': Number(collDjt.djtCost) || 0 } }
                    );
                }
            }
        }
        console.log(`   ${stats.fix1_djtCost} embeds will have djtCost set\n`);

        // ══════════════════════════════════════════════════
        // FIX 2: Copy DJTSignatures → collection.signatures
        //        where collection has 0 but schedule has >0
        // ══════════════════════════════════════════════════
        console.log('── FIX 2: DJTSignatures → collection.signatures ──');
        for (const [schedId, embedData] of embedByScheduleId) {
            const collDjt = collByScheduleId.get(schedId);
            if (!collDjt) continue;

            const collSigs = collDjt.signatures || [];
            const schedSigs = embedData.DJTSignatures || [];

            if (collSigs.length === 0 && schedSigs.length > 0) {
                stats.fix2_sigs_to_collection++;
                if (!DRY_RUN) {
                    await djtColl.updateOne(
                        { _id: collDjt._id },
                        { $set: { signatures: schedSigs } }
                    );
                    // Also sync embed's djt.signatures
                    await schedColl.updateOne(
                        { _id: schedId },
                        { $set: { 'djt.signatures': schedSigs } }
                    );
                }
            } else if (collSigs.length > 0 && schedSigs.length > 0 && collSigs.length !== schedSigs.length) {
                // Merge: take the set with more signatures
                const winner = collSigs.length >= schedSigs.length ? collSigs : schedSigs;
                stats.fix3_sigs_merged++;
                if (!DRY_RUN) {
                    await djtColl.updateOne(
                        { _id: collDjt._id },
                        { $set: { signatures: winner } }
                    );
                    await schedColl.updateOne(
                        { _id: schedId },
                        { $set: { 'djt.signatures': winner, DJTSignatures: winner } }
                    );
                }
            }
        }
        console.log(`   ${stats.fix2_sigs_to_collection} collection records will receive DJTSignatures`);
        console.log(`   ${stats.fix3_sigs_merged} records will have signatures merged (larger set wins)\n`);

        // ══════════════════════════════════════════════════
        // FIX 3: Sync djtEmails and emailCounter
        //        Prefer the richer set (more emails)
        // ══════════════════════════════════════════════════
        console.log('── FIX 3: Sync djtEmails/emailCounter ──');
        for (const [schedId, embedData] of embedByScheduleId) {
            const collDjt = collByScheduleId.get(schedId);
            if (!collDjt) continue;

            const collEmails = collDjt.djtEmails || [];
            const embedEmails = embedData.djt.djtEmails || [];

            if (JSON.stringify(collEmails) !== JSON.stringify(embedEmails)) {
                const winner = collEmails.length >= embedEmails.length ? collEmails : embedEmails;
                const winnerCounter = Math.max(collDjt.emailCounter || 0, embedData.djt.emailCounter || 0);
                stats.fix7_emails_synced++;
                if (!DRY_RUN) {
                    await djtColl.updateOne(
                        { _id: collDjt._id },
                        { $set: { djtEmails: winner, emailCounter: winnerCounter } }
                    );
                    await schedColl.updateOne(
                        { _id: schedId },
                        { $set: { 'djt.djtEmails': winner, 'djt.emailCounter': winnerCounter } }
                    );
                }
            }
        }
        console.log(`   ${stats.fix7_emails_synced} records will have emails synced\n`);

        // ══════════════════════════════════════════════════
        // FIX 4: Category C — Copy collection → embed
        // ══════════════════════════════════════════════════
        console.log('── FIX 4: Category C — collection only → create embed ──');
        for (const [schedId, collDjt] of collByScheduleId) {
            if (embedByScheduleId.has(schedId)) continue;

            // Check if the schedule exists
            const scheduleExists = await schedColl.findOne(
                { _id: schedId },
                { projection: { _id: 1 } }
            );
            
            if (!scheduleExists) {
                console.log(`   ⚠️  Schedule ${schedId} not found — skipping orphaned DJT ${collDjt._id}`);
                continue;
            }

            stats.fix4_embed_from_collection++;
            const embedObj = { ...collDjt };
            delete embedObj.schedule_id;  // Not needed in embed
            // Keep _id for consistency

            if (!DRY_RUN) {
                await schedColl.updateOne(
                    { _id: schedId },
                    { $set: { djt: embedObj, DJTSignatures: collDjt.signatures || [] } }
                );
            }
            console.log(`   → Schedule ${schedId}: embedding DJT ${collDjt._id} (sigs: ${(collDjt.signatures || []).length}, equip: ${(collDjt.equipmentUsed || []).length})`);
        }
        console.log(`   ${stats.fix4_embed_from_collection} embeds will be created from collection\n`);

        // ══════════════════════════════════════════════════
        // FIX 5: Category D — Create collection from embed
        // ══════════════════════════════════════════════════
        console.log('── FIX 5: Category D — embed only → create collection record ──');
        for (const [schedId, embedData] of embedByScheduleId) {
            if (collByScheduleId.has(schedId)) continue;

            const embedDjt = embedData.djt;
            
            // Check if this _id already exists in the collection (schedule_id mismatch)
            const existingById = embedDjt._id ? collById.get(String(embedDjt._id)) : null;

            if (existingById) {
                // The DJT exists in collection but points to a different schedule.
                // This is a copied/stale embed. We need to create a NEW DJT for this schedule.
                const newId = new mongoose.Types.ObjectId().toString();
                
                stats.fix5_collection_from_embed++;
                console.log(`   → Schedule ${schedId}: creating NEW DJT (stale copy of ${embedDjt._id})`);
                
                if (!DRY_RUN) {
                    const newDoc = {
                        _id: newId,
                        schedule_id: schedId,
                        dailyJobDescription: embedDjt.dailyJobDescription || '',
                        customerPrintName: embedDjt.customerPrintName || '',
                        customerSignature: embedDjt.customerSignature || '',
                        createdBy: embedDjt.createdBy || '',
                        clientEmail: embedDjt.clientEmail || '',
                        emailCounter: embedDjt.emailCounter || 0,
                        djtCost: embedDjt.djtCost || 0,
                        equipmentUsed: embedDjt.equipmentUsed || [],
                        djtimages: embedDjt.djtimages || [],
                        djtEmails: embedDjt.djtEmails || [],
                        signatures: embedData.DJTSignatures || embedDjt.signatures || [],
                        createdAt: embedDjt.createdAt || new Date(),
                        updatedAt: new Date(),
                    };
                    await djtColl.insertOne(newDoc);
                    
                    // Update embed to use the new _id
                    await schedColl.updateOne(
                        { _id: schedId },
                        { $set: { 'djt._id': newId } }
                    );
                }
            } else {
                // No existing record at all — create from embed
                stats.fix5_collection_from_embed++;
                console.log(`   → Schedule ${schedId}: creating DJT from embed (id: ${embedDjt._id || 'new'})`);
                
                if (!DRY_RUN) {
                    const newDoc = {
                        _id: embedDjt._id || new mongoose.Types.ObjectId().toString(),
                        schedule_id: schedId,
                        dailyJobDescription: embedDjt.dailyJobDescription || '',
                        customerPrintName: embedDjt.customerPrintName || '',
                        customerSignature: embedDjt.customerSignature || '',
                        createdBy: embedDjt.createdBy || '',
                        clientEmail: embedDjt.clientEmail || '',
                        emailCounter: embedDjt.emailCounter || 0,
                        djtCost: embedDjt.djtCost || 0,
                        equipmentUsed: embedDjt.equipmentUsed || [],
                        djtimages: embedDjt.djtimages || [],
                        djtEmails: embedDjt.djtEmails || [],
                        signatures: embedData.DJTSignatures || embedDjt.signatures || [],
                        createdAt: embedDjt.createdAt || new Date(),
                        updatedAt: new Date(),
                    };
                    await djtColl.insertOne(newDoc);
                }
            }
        }
        console.log(`   ${stats.fix5_collection_from_embed} collection records will be created from embeds\n`);

        // ══════════════════════════════════════════════════
        // SUMMARY
        // ══════════════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════');
        console.log('         RECONCILIATION SUMMARY');
        console.log('═══════════════════════════════════════════════════');
        console.log(`   FIX 1 — djtCost synced:           ${stats.fix1_djtCost}`);
        console.log(`   FIX 2 — Signatures copied to col: ${stats.fix2_sigs_to_collection}`);
        console.log(`   FIX 3 — Signatures merged:        ${stats.fix3_sigs_merged}`);
        console.log(`   FIX 4 — Embeds created (Cat C):   ${stats.fix4_embed_from_collection}`);
        console.log(`   FIX 5 — Collection created (Cat D):${stats.fix5_collection_from_embed}`);
        console.log(`   FIX 6 — Emails synced:            ${stats.fix7_emails_synced}`);
        console.log(`   Errors:                            ${stats.errors}`);
        console.log('═══════════════════════════════════════════════════');
        
        if (DRY_RUN) {
            console.log('\n🔍 This was a DRY RUN. To execute, run:');
            console.log('   node scripts/reconcile-djt.js --execute');
        } else {
            console.log('\n✅ Reconciliation complete! Re-run the audit to verify:');
            console.log('   node scripts/audit-djt-dual-storage.js');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
