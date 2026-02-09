import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Schedule from '@/lib/models/Schedule';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        
        // Migration: convert any preBore stored as object to array
        // Uses native driver since Mongoose doesn't support pipeline updates by default
        await Schedule.collection.updateMany(
            { preBore: { $exists: true, $not: { $type: 'array' } } },
            [{ $set: { preBore: { $cond: { if: { $eq: [{ $type: '$preBore' }, 'object'] }, then: ['$preBore'], else: [] } } } }]
        );
        
        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            case 'getPreBoreLogs': {
                // Find all schedules that have preBore data
                const { limit = 500 } = payload || {};
                
                const schedules = await Schedule.find(
                    { 'preBore.0': { $exists: true } },
                    { _id: 1, title: 1, estimate: 1, customerName: 1, foremanName: 1, preBore: 1 }
                )
                    .sort({ updatedAt: -1 })
                    .limit(limit)
                    .lean();
                
                // Flatten: one result per preBore entry
                const result: any[] = [];
                for (const s of schedules as any[]) {
                    if (s.preBore && Array.isArray(s.preBore)) {
                        for (const pb of s.preBore) {
                            result.push({
                                _id: s._id,
                                scheduleTitle: s.title,
                                estimate: s.estimate,
                                scheduleForemanName: s.foremanName,
                                scheduleCustomerName: s.customerName,
                                preBoreId: pb._id,
                                legacyId: pb.legacyId,
                                ...pb,
                                preBoreLogs: pb.preBoreLogs || []
                            });
                        }
                    }
                }
                
                return NextResponse.json({ success: true, result });
            }

            case 'getPreBoreLog': {
                const { id } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                const schedule = await Schedule.findById(id, { _id: 1, title: 1, estimate: 1, preBore: 1 }).lean();
                if (!schedule) {
                    return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
                }
                return NextResponse.json({ success: true, result: { _id: (schedule as any)._id, preBore: (schedule as any).preBore || [] } });
            }

            case 'createPreBoreLog': {
                const { scheduleId, item } = payload;
                if (!scheduleId) {
                    return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
                }
                
                // Push a new preBore entry into the schedule's preBore array
                const updated = await Schedule.findByIdAndUpdate(
                    scheduleId,
                    { $push: { preBore: item } },
                    { new: true }
                ).lean();
                
                if (!updated) {
                    return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
                }
                
                return NextResponse.json({ success: true, result: updated });
            }

            case 'updatePreBoreLog': {
                const { id, preBoreIndex, item } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                
                // Update a specific preBore entry by matching legacyId
                const legacyId = item.legacyId || item.legacyid;
                
                if (legacyId) {
                    // Update by legacyId match within the array
                    const setObj: any = {};
                    for (const [key, val] of Object.entries(item)) {
                        setObj[`preBore.$.${key}`] = val;
                    }
                    
                    const updated = await Schedule.findOneAndUpdate(
                        { _id: id, 'preBore.legacyId': legacyId },
                        { $set: setObj },
                        { new: true }
                    ).lean();
                    
                    if (updated) {
                        return NextResponse.json({ success: true, result: updated });
                    }
                }
                
                // Fallback: update by index
                if (preBoreIndex !== undefined) {
                    const setObj: any = {};
                    for (const [key, val] of Object.entries(item)) {
                        setObj[`preBore.${preBoreIndex}.${key}`] = val;
                    }
                    
                    const updated = await Schedule.findByIdAndUpdate(
                        id,
                        { $set: setObj },
                        { new: true }
                    ).lean();
                    
                    if (!updated) {
                        return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
                    }
                    return NextResponse.json({ success: true, result: updated });
                }
                
                return NextResponse.json({ success: false, error: 'legacyId or preBoreIndex required' }, { status: 400 });
            }

            case 'deletePreBoreLog': {
                const { id, legacyId } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                
                // Pull the specific preBore entry from the array
                const updated = await Schedule.findByIdAndUpdate(
                    id,
                    { $pull: { preBore: { legacyId: legacyId } } },
                    { new: true }
                );
                
                if (!updated) {
                    return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
                }
                
                return NextResponse.json({ success: true, message: 'Pre-Bore entry removed' });
            }

            case 'importPreBoreLogs': {
                // Import preBore parent data into schedules' preBore array
                // Each row has a scheduleid referencing the Schedule _id
                const { records } = payload;
                if (!records || !Array.isArray(records) || records.length === 0) {
                    return NextResponse.json({ success: false, error: 'No records provided' }, { status: 400 });
                }

                let updated = 0;
                let notFound = 0;

                for (const row of records) {
                    const schedId = row.scheduleid || row.scheduleId || row.ScheduleId || '';
                    const legacy = row.legacyid || row.legacyId || row.LegacyId || '';

                    if (!schedId) {
                        console.warn('Skipping preBore row without scheduleid:', row);
                        notFound++;
                        continue;
                    }

                    const preBoreEntry: any = {
                        legacyId: legacy,
                        date: (row.date || row.Date) ? new Date(row.date || row.Date) : new Date(),
                        customerForeman: row.customerForeman || row.customerforeman || '',
                        customerWorkRequestNumber: row.customerWorkRequestNumber || row.customerworkrequestnumber || '',
                        startTime: row.startTime || row.starttime || '',
                        addressBoreStart: row.addressBoreStart || row.addressborestart || '',
                        addressBoreEnd: row.addressBoreEnd || row.addressboreend || '',
                        devcoOperator: row.devcoOperator || row.devcooperator || '',
                        drillSize: row.drillSize || row.drillsize || '',
                        pilotBoreSize: row.pilotBoreSize || row.pilotboresize || '',
                        reamerSize6: row.reamerSize6 || row.reamersize6 || '',
                        reamerSize8: row.reamerSize8 || row.reamersize8 || '',
                        reamerSize10: row.reamerSize10 || row.reamersize10 || '',
                        reamerSize12: row.reamerSize12 || row.reamersize12 || '',
                        soilType: row.soilType || row.soiltype || '',
                        boreLength: row.boreLength || row.borelength || '',
                        pipeSize: row.pipeSize || row.pipesize || '',
                        foremanSignature: row.foremanSignature || row.foremansignature || row.formanSignature || row.formansignature || '',
                        customerName: row.customerName || row.customername || '',
                        customerSignature: row.customerSignature || row.customersignature || '',
                        preBoreLogs: [],
                        createdBy: row.createdBy || row.createdby || 'csv-import',
                        createdAt: (row.createdAt || row.createdat) ? new Date(row.createdAt || row.createdat) : new Date()
                    };

                    // Push into the schedule's preBore array
                    const result = await Schedule.findByIdAndUpdate(
                        schedId,
                        { $push: { preBore: preBoreEntry } },
                        { new: true }
                    );

                    if (result) {
                        updated++;
                    } else {
                        console.warn(`Schedule not found for id: ${schedId}`);
                        notFound++;
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Imported ${updated} pre-bore logs into schedules${notFound > 0 ? ` (${notFound} schedules not found)` : ''}`,
                    count: updated,
                    notFound
                });
            }

            case 'importPreBoreLogItems': {
                // Import rod items into schedule.preBore[].preBoreLogs
                // legacyid in the CSV = reference to the preBore entry's legacyId
                const { records } = payload;
                if (!records || !Array.isArray(records) || records.length === 0) {
                    return NextResponse.json({ success: false, error: 'No records provided' }, { status: 400 });
                }

                // Group items by parent preBore legacyId
                const itemsByLog: Record<string, any[]> = {};
                let skipped = 0;

                for (const row of records) {
                    // legacyid is the reference to the parent preBore's legacyId
                    const parentRef = row.legacyid || row.legacyId || row.LegacyId || row.parentId || row.parentid || row.logId || row.logid;
                    if (!parentRef) {
                        console.warn('Skipping item without parent reference:', row);
                        skipped++;
                        continue;
                    }

                    if (!itemsByLog[parentRef]) {
                        itemsByLog[parentRef] = [];
                    }

                    itemsByLog[parentRef].push({
                        _id: row._id || row.itemId || `${parentRef}-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        rodNumber: row.rodNumber || row.rodnumber || '',
                        distance: row.distance || '',
                        topDepth: row.topDepth || row.topdepth || '',
                        bottomDepth: row.bottomDepth || row.bottomdepth || '',
                        overOrUnder: row.overOrUnder || row.overorunder || '',
                        existingUtilities: row.existingUtilities || row.existingutilities || '',
                        picture: row.picture || '',
                        createdBy: row.createdBy || row.createdby || 'csv-import',
                        createdAt: (row.createdAt || row.createdat || row.createdBy_1) ? new Date(row.createdAt || row.createdat || row.createdBy_1) : new Date()
                    });
                }

                let updatedCount = 0;
                let itemCount = 0;
                let notFound = 0;

                for (const [parentRef, items] of Object.entries(itemsByLog)) {
                    // Find schedule that has a preBore entry with matching legacyId
                    // Use positional operator $ to push into matching preBore element's preBoreLogs
                    const result = await Schedule.findOneAndUpdate(
                        { 'preBore.legacyId': parentRef },
                        { $push: { 'preBore.$.preBoreLogs': { $each: items } } },
                        { new: true }
                    );

                    if (result) {
                        updatedCount++;
                        itemCount += items.length;
                    } else {
                        console.warn(`No schedule found with preBore.legacyId: ${parentRef} (${items.length} items skipped)`);
                        notFound++;
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Added ${itemCount} items to ${updatedCount} pre-bore logs${notFound > 0 ? ` (${notFound} parent logs not found)` : ''}${skipped > 0 ? ` (${skipped} rows skipped - no parent ref)` : ''}`,
                    count: itemCount,
                    updated: updatedCount,
                    notFound,
                    skipped
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

        const schedules = await Schedule.find(
            { 'preBore.0': { $exists: true } },
            { _id: 1, title: 1, estimate: 1, customerName: 1, foremanName: 1, preBore: 1 }
        )
            .sort({ updatedAt: -1 })
            .limit(500)
            .lean();

        const result: any[] = [];
        for (const s of schedules as any[]) {
            if (s.preBore && Array.isArray(s.preBore)) {
                for (const pb of s.preBore) {
                    result.push({
                        _id: s._id,
                        scheduleTitle: s.title,
                        estimate: s.estimate,
                        ...pb,
                        preBoreLogs: pb.preBoreLogs || []
                    });
                }
            }
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('Pre-Bore Logs GET Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
