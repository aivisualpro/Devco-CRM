import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import PreBoreLog from '@/lib/models/PreBoreLog';
import Schedule from '@/lib/models/Schedule';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();

        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            // ==================== READ ====================
            case 'getPreBoreLogs': {
                const { limit = 500, estimate } = payload || {};

                const filter: any = {};
                if (estimate) {
                    // Match estimate number with or without version suffix
                    const baseEstimate = estimate.includes('-') ? estimate.split('-').slice(0, 2).join('-') : estimate;
                    filter.estimate = { $regex: new RegExp(`^${baseEstimate}`, 'i') };
                }

                const result = await PreBoreLog.find(filter)
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();

                return NextResponse.json({ success: true, result });
            }

            case 'getPreBoreLog': {
                const { id } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                const doc = await PreBoreLog.findById(id).lean();
                if (!doc) {
                    return NextResponse.json({ success: false, error: 'Pre-bore log not found' }, { status: 404 });
                }
                return NextResponse.json({ success: true, result: doc });
            }

            // ==================== CREATE ====================
            case 'createPreBoreLog': {
                const { scheduleId, item } = payload;

                // Fetch parent schedule metadata if scheduleId provided (for auto-populating fields)
                let scheduleMeta: any = {};
                if (scheduleId) {
                    const sched = await Schedule.findById(scheduleId, {
                        _id: 1, estimate: 1, customerId: 1, customerName: 1, foremanName: 1
                    }).lean() as any;
                    if (sched) {
                        scheduleMeta = {
                            estimate: sched.estimate || '',
                            customerId: sched.customerId || '',
                            scheduleCustomerName: sched.customerName || '',
                            foremanName: sched.foremanName || '',
                        };
                    }
                }

                const newDoc = await PreBoreLog.create({
                    _id: `PB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    ...scheduleMeta,
                    ...item,
                    date: item.date || new Date(),
                });

                return NextResponse.json({ success: true, result: newDoc });
            }

            // ==================== UPDATE ====================
            case 'updatePreBoreLog': {
                const { id, item } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }

                const legacyId = item?.legacyId || item?.legacyid;

                // Try to find by direct _id first, then by legacyId
                let doc = await PreBoreLog.findById(id);
                if (!doc && legacyId) {
                    doc = await PreBoreLog.findOne({ legacyId });
                }

                if (!doc) {
                    return NextResponse.json({ success: false, error: 'Pre-bore log not found' }, { status: 404 });
                }

                // Update all fields from item
                const updateFields = { ...item };
                delete updateFields._id; // Never overwrite _id
                delete updateFields.legacyId; // Preserve original legacyId

                Object.assign(doc, updateFields);
                await doc.save();

                return NextResponse.json({ success: true, result: doc });
            }

            // ==================== DELETE ====================
            case 'deletePreBoreLog': {
                const { id, legacyId } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }

                // Try direct _id delete first
                let deleted = await PreBoreLog.findByIdAndDelete(id);
                if (!deleted && legacyId) {
                    deleted = await PreBoreLog.findOneAndDelete({ legacyId });
                }

                if (!deleted) {
                    return NextResponse.json({ success: false, error: 'Pre-bore log not found' }, { status: 404 });
                }

                return NextResponse.json({ success: true, message: 'Pre-Bore Log deleted' });
            }

            // ==================== EXPORT ====================
            case 'exportPreBoreLogs': {
                const allLogs = await PreBoreLog.find()
                    .sort({ createdAt: -1 })
                    .lean();

                return NextResponse.json({
                    success: true,
                    result: allLogs,
                    exportedAt: new Date().toISOString(),
                    version: 2
                });
            }

            // ==================== IMPORT JSON ====================
            case 'importPreBoreLogsJSON': {
                const { records } = payload;
                if (!records || !Array.isArray(records) || records.length === 0) {
                    return NextResponse.json({ success: false, error: 'No records provided' }, { status: 400 });
                }

                let imported = 0;
                let skipped = 0;

                for (const record of records) {
                    const docId = record._id;
                    if (docId) {
                        const exists = await PreBoreLog.findById(docId).lean();
                        if (exists) { skipped++; continue; }
                    }

                    try {
                        await PreBoreLog.create({
                            ...record,
                            _id: docId || `PB-import-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        });
                        imported++;
                    } catch (err: any) {
                        console.error('Import error for record:', err.message);
                        skipped++;
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Imported ${imported} pre-bore logs (${skipped} skipped/duplicates)`,
                    imported,
                    skipped
                });
            }

            // ==================== MIGRATION: Copy from Schedules ====================
            case 'migrateFromSchedules': {
                const schedules = await Schedule.find(
                    { 'preBore.0': { $exists: true } },
                    { _id: 1, estimate: 1, customerId: 1, customerName: 1, foremanName: 1, preBore: 1 }
                ).lean() as any[];

                let copied = 0;
                let skipped = 0;
                let failed = 0;

                for (const sched of schedules) {
                    if (!sched.preBore || !Array.isArray(sched.preBore)) continue;

                    for (const pb of sched.preBore) {
                        const existingKey = pb.legacyId || pb._id;
                        if (existingKey) {
                            const exists = await PreBoreLog.findOne({
                                $or: [
                                    { legacyId: String(existingKey) },
                                    { _id: String(existingKey) },
                                ]
                            } as any).lean();
                            if (exists) { skipped++; continue; }
                        }

                        try {
                            const doc: any = {
                                _id: pb._id ? String(pb._id) : `PB-mig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                legacyId: pb.legacyId || '',
                                estimate: sched.estimate || '',
                                customerId: sched.customerId || '',
                                scheduleCustomerName: sched.customerName || '',
                                foremanName: sched.foremanName || '',
                                date: pb.date || new Date(),
                                customerForeman: pb.customerForeman || '',
                                customerWorkRequestNumber: pb.customerWorkRequestNumber || '',
                                startTime: pb.startTime || '',
                                addressBoreStart: pb.addressBoreStart || '',
                                addressBoreEnd: pb.addressBoreEnd || '',
                                devcoOperator: pb.devcoOperator || '',
                                drillSize: pb.drillSize || '',
                                pilotBoreSize: pb.pilotBoreSize || '',
                                reamerSize6: pb.reamerSize6 || '',
                                reamerSize8: pb.reamerSize8 || '',
                                reamerSize10: pb.reamerSize10 || '',
                                reamerSize12: pb.reamerSize12 || '',
                                reamers: pb.reamers || '',
                                soilType: pb.soilType || '',
                                boreLength: pb.boreLength || '',
                                pipeSize: pb.pipeSize || '',
                                foremanSignature: pb.foremanSignature || '',
                                customerName: pb.customerName || '',
                                customerSignature: pb.customerSignature || '',
                                preBoreLogs: (pb.preBoreLogs || []).map((item: any) => ({
                                    _id: item._id || undefined,
                                    legacyId: item.legacyId || '',
                                    rodNumber: item.rodNumber || '',
                                    distance: item.distance || '',
                                    topDepth: item.topDepth || '',
                                    bottomDepth: item.bottomDepth || '',
                                    overOrUnder: item.overOrUnder || '',
                                    existingUtilities: item.existingUtilities || '',
                                    picture: item.picture || '',
                                    createdBy: item.createdBy || '',
                                    createdAt: item.createdAt || new Date(),
                                })),
                                createdBy: pb.createdBy || '',
                            };

                            const created: any = await PreBoreLog.create(doc);
                            if (pb.createdAt) {
                                await PreBoreLog.updateOne(
                                    { _id: created._id } as any,
                                    { $set: { createdAt: new Date(pb.createdAt) } }
                                );
                            }
                            copied++;
                        } catch (err: any) {
                            console.error(`Failed to copy preBore entry from schedule ${sched._id}:`, err.message);
                            failed++;
                        }
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Migration complete: ${copied} entries copied, ${skipped} already existed, ${failed} failed. Original schedule data is UNTOUCHED.`,
                    copied,
                    skipped,
                    failed
                });
            }

            // ==================== PATCH: Back-fill metadata from schedules ====================
            case 'patchScheduleMetadata': {
                // Rename old field names in existing DB documents + back-fill missing data
                // Step 1: Rename old fields → new fields in bulk
                const col = PreBoreLog.collection;
                await col.updateMany(
                    { scheduleCustomerId: { $exists: true } },
                    { $rename: { 'scheduleCustomerId': 'customerId' } }
                );
                await col.updateMany(
                    { scheduleForemanName: { $exists: true } },
                    { $rename: { 'scheduleForemanName': 'foremanName' } }
                );
                // Remove obsolete fields
                await col.updateMany(
                    { scheduleId: { $exists: true } },
                    { $unset: { scheduleId: '', scheduleTitle: '' } }
                );

                // Step 2: Back-fill missing estimate/customerId from schedule reference
                // For records that still have empty fields, try to resolve via legacyId or other means
                const allLogs = await PreBoreLog.find({
                    $or: [
                        { estimate: { $in: ['', null] } },
                        { customerId: { $in: ['', null] } },
                        { foremanName: { $in: ['', null] } },
                    ]
                }).lean() as any[];

                // Get unique legacy IDs to find parent schedules
                const allSchedules = await Schedule.find(
                    { 'preBore.0': { $exists: true } },
                    { _id: 1, estimate: 1, customerId: 1, customerName: 1, foremanName: 1, preBore: 1 }
                ).lean() as any[];

                // Build a map: preBore._id or legacyId → schedule metadata
                const pbToSchedMap = new Map<string, any>();
                for (const s of allSchedules) {
                    if (!s.preBore) continue;
                    for (const pb of s.preBore) {
                        if (pb._id) pbToSchedMap.set(String(pb._id), s);
                        if (pb.legacyId) pbToSchedMap.set(String(pb.legacyId), s);
                    }
                }

                let patched = 0;
                for (const log of allLogs) {
                    const sched = pbToSchedMap.get(String(log._id)) || pbToSchedMap.get(String(log.legacyId));
                    if (!sched) continue;

                    const updates: any = {};
                    if (!log.estimate && sched.estimate) updates.estimate = sched.estimate;
                    if (!log.customerId && sched.customerId) updates.customerId = sched.customerId;
                    if (!log.scheduleCustomerName && sched.customerName) updates.scheduleCustomerName = sched.customerName;
                    if (!log.foremanName && sched.foremanName) updates.foremanName = sched.foremanName;

                    if (Object.keys(updates).length > 0) {
                        await PreBoreLog.updateOne({ _id: log._id }, { $set: updates });
                        patched++;
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Patched ${patched} records. Renamed scheduleCustomerId→customerId, scheduleForemanName→foremanName. Removed scheduleId & scheduleTitle.`,
                    patched,
                    total: allLogs.length
                });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Pre-Bore Logs API Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();

        const result = await PreBoreLog.find()
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('Pre-Bore Logs GET Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
