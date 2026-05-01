/**
 * DJT Dual-Storage Audit API (READ-ONLY)
 * 
 * Temporary API route to audit DJT data across both stores.
 * Access: GET /api/audit-djt
 * 
 * ⚠️  DELETE THIS ROUTE after the audit is complete.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) {
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

const COMPARE_FIELDS = [
    '_id', 'dailyJobDescription', 'customerPrintName', 'customerSignature',
    'createdBy', 'clientEmail', 'emailCounter', 'djtCost', 'djtTime',
];
const ARRAY_FIELDS = ['equipmentUsed', 'djtEmails', 'signatures'];

export async function GET() {
    try {
        await connectToDatabase();
        const db = mongoose.connection.db!;

        // 1. Fetch all standalone DJTs
        const collectionDjts = await db.collection('dailyjobtickets').find({}).toArray();

        // 2. Fetch all schedules with non-null djt
        const schedulesWithDjt = await db.collection('devcoschedules').find(
            { djt: { $ne: null, $exists: true } },
            {
                projection: {
                    _id: 1, djt: 1, DJTSignatures: 1, estimate: 1,
                    fromDate: 1, item: 1, customerName: 1
                }
            }
        ).toArray();

        const schedulesWithRealDjt = schedulesWithDjt.filter(s =>
            s.djt && typeof s.djt === 'object' && Object.keys(s.djt).length > 0
        );

        const totalSchedules = await db.collection('devcoschedules').countDocuments();
        const dayOffSchedules = await db.collection('devcoschedules').countDocuments({ item: 'Day Off' });

        // Build lookup maps
        const collectionByScheduleId = new Map<string, any>();
        const collectionById = new Map<string, any>();
        collectionDjts.forEach(djt => {
            if (djt.schedule_id) collectionByScheduleId.set(String(djt.schedule_id), djt);
            collectionById.set(String(djt._id), djt);
        });

        const embedByScheduleId = new Map<string, any>();
        schedulesWithRealDjt.forEach(s => {
            embedByScheduleId.set(String(s._id), {
                ...s.djt,
                _scheduleId: String(s._id),
                _scheduleMeta: { estimate: s.estimate, fromDate: s.fromDate, customerName: s.customerName, item: s.item },
                _DJTSignatures: s.DJTSignatures
            });
        });

        // ─── Categorize ───
        const categoryA: any[] = [];
        const categoryB: any[] = [];
        const categoryC: any[] = [];
        const categoryD: any[] = [];

        for (const [scheduleId, collDjt] of collectionByScheduleId) {
            const embedDjt = embedByScheduleId.get(scheduleId);

            if (!embedDjt) {
                categoryC.push({
                    schedule_id: scheduleId,
                    djt_id: String(collDjt._id),
                    createdBy: collDjt.createdBy,
                    createdAt: collDjt.createdAt,
                    hasDescription: !!collDjt.dailyJobDescription,
                    signaturesCount: (collDjt.signatures || []).length,
                    equipmentCount: (collDjt.equipmentUsed || []).length,
                    imagesCount: (collDjt.djtimages || []).length,
                });
                continue;
            }

            const diffs: any[] = [];

            for (const field of COMPARE_FIELDS) {
                if (!deepEqual(collDjt[field], embedDjt[field])) {
                    diffs.push({
                        field,
                        collection: collDjt[field] !== undefined ? String(collDjt[field]).substring(0, 100) : '<missing>',
                        embed: embedDjt[field] !== undefined ? String(embedDjt[field]).substring(0, 100) : '<missing>',
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

            // Check djtimages
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

        // Remaining embeds → Category D
        for (const [scheduleId, embedDjt] of embedByScheduleId) {
            const matchById = embedDjt._id ? collectionById.get(String(embedDjt._id)) : null;
            categoryD.push({
                schedule_id: scheduleId,
                djt_id: embedDjt._id ? String(embedDjt._id) : '<no _id>',
                createdBy: embedDjt.createdBy,
                createdAt: embedDjt.createdAt,
                hasDescription: !!embedDjt.dailyJobDescription,
                signaturesCount: (embedDjt.signatures || []).length,
                equipmentCount: (embedDjt.equipmentUsed || []).length,
                imagesCount: (embedDjt.djtimages || []).length,
                scheduleMeta: embedDjt._scheduleMeta,
                matchedInCollectionById: matchById ? String(matchById._id) : null,
            });
        }

        // ─── Field divergence stats ───
        const fieldDivergenceCounts: Record<string, number> = {};
        categoryB.forEach(item => {
            item.diffs.forEach((d: any) => {
                fieldDivergenceCounts[d.field] = (fieldDivergenceCounts[d.field] || 0) + 1;
            });
            if (item.sigsMismatch) {
                fieldDivergenceCounts['DJTSignatures_vs_signatures'] =
                    (fieldDivergenceCounts['DJTSignatures_vs_signatures'] || 0) + 1;
            }
        });

        return NextResponse.json({
            success: true,
            summary: {
                collection_total: collectionDjts.length,
                embed_total: schedulesWithRealDjt.length,
                total_schedules: totalSchedules,
                day_off_schedules: dayOffSchedules,
                non_day_off_schedules: totalSchedules - dayOffSchedules,
                total_unique_djts: categoryA.length + categoryB.length + categoryC.length + categoryD.length,
            },
            categories: {
                A_both_match: { count: categoryA.length, sample: categoryA.slice(0, 5) },
                B_both_differ: { count: categoryB.length, fieldDivergence: fieldDivergenceCounts, records: categoryB.slice(0, 30) },
                C_collection_only: { count: categoryC.length, records: categoryC.slice(0, 20) },
                D_embed_only: { count: categoryD.length, records: categoryD.slice(0, 20) },
            }
        });
    } catch (error: any) {
        console.error('Audit error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
