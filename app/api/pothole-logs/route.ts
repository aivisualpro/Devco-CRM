import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import PotholeLog from '@/lib/models/PotholeLog';

// Helper to safely parse locationOfPothole
function parseLocation(loc: any): { lat: number; lng: number } | undefined {
    if (!loc) return undefined;
    if (typeof loc === 'object' && loc.lat !== undefined && loc.lng !== undefined) {
        return { lat: Number(loc.lat), lng: Number(loc.lng) };
    }
    if (typeof loc === 'string') {
        // Try to parse as JSON
        try {
            const parsed = JSON.parse(loc);
            if (parsed.lat !== undefined && parsed.lng !== undefined) {
                return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
            }
        } catch {
            // Not valid JSON, check if it's a "lat,lng" format
            const parts = loc.split(',').map((s: string) => s.trim());
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    return { lat, lng };
                }
            }
        }
    }
    return undefined;
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            case 'getPotholeLogs': {
                const { limit = 500, estimate } = payload || {};
                const filter: any = {};
                if (estimate) filter.estimate = estimate;
                
                const logs = await PotholeLog.find(filter)
                    .sort({ date: -1 })
                    .limit(limit)
                    .lean();
                
                return NextResponse.json({ success: true, result: logs });
            }

            case 'getPotholeLog': {
                const { id } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                const log = await PotholeLog.findById(id).lean();
                if (!log) {
                    return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
                }
                return NextResponse.json({ success: true, result: log });
            }

            case 'createPotholeLog': {
                const { item } = payload;
                if (!item) {
                    return NextResponse.json({ success: false, error: 'Item data is required' }, { status: 400 });
                }
                
                // Generate ID if not provided
                if (!item._id) {
                    item._id = `PH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                
                const newLog = new PotholeLog(item);
                await newLog.save();
                
                return NextResponse.json({ success: true, result: newLog });
            }

            case 'updatePotholeLog': {
                const { id, item } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                
                const updated = await PotholeLog.findByIdAndUpdate(
                    id,
                    { $set: item },
                    { new: true }
                ).lean();
                
                if (!updated) {
                    return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
                }
                
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deletePotholeLog': {
                const { id } = payload;
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
                }
                
                const deleted = await PotholeLog.findByIdAndDelete(id);
                if (!deleted) {
                    return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
                }
                
                return NextResponse.json({ success: true, message: 'Deleted successfully' });
            }

            case 'importPotholeLogs': {
                const { records } = payload;
                if (!records || !Array.isArray(records) || records.length === 0) {
                    return NextResponse.json({ success: false, error: 'No records provided' }, { status: 400 });
                }

                // Group records by parent ID (the _id field in CSV represents parent reference)
                // Each row in CSV is a pothole item, group them by their parent log
                const logGroups: Record<string, any> = {};

                for (const row of records) {
                    // The _id in CSV is the parent pothole log's ID
                    const parentId = row._id || row.oldrefid || `PH-IMPORT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    
                    if (!logGroups[parentId]) {
                        logGroups[parentId] = {
                            _id: parentId,
                            oldrefid: row.oldrefid || '',
                            date: row.date ? new Date(row.date) : new Date(),
                            estimate: row.estimate || '',
                            projectionLocation: row.projectionLocation || row.projectLocation || '',
                            locationOfPothole: parseLocation(row.locationOfPothole),
                            potholeItems: [],
                            createdBy: row.createdBy || 'csv-import',
                            createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
                        };
                    }

                    // Add pothole item if there's item data
                    if (row.potholeNo || row.typeOfUtility || row.soilType) {
                        logGroups[parentId].potholeItems.push({
                            _id: row.itemId || `${parentId}-item-${logGroups[parentId].potholeItems.length}`,
                            potholeNo: row.potholeNo || '',
                            typeOfUtility: row.typeOfUtility || '',
                            soilType: row.soilType || '',
                            topDepthOfUtility: row.topDepthOfUtility || '',
                            bottomDepthOfUtility: row.bottomDepthOfUtility || '',
                            photo1: row.photo1 || '',
                            photo2: row.photo2 || '',
                            pin: row.pin || '',
                            createdBy: row.createdBy || 'csv-import',
                            createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
                        });
                    }
                }

                const logsToInsert = Object.values(logGroups);
                
                // Upsert each log
                const results = await Promise.all(
                    logsToInsert.map(log => 
                        PotholeLog.findByIdAndUpdate(
                            log._id,
                            { $set: log },
                            { upsert: true, new: true }
                        )
                    )
                );

                return NextResponse.json({ 
                    success: true, 
                    message: `Imported ${results.length} pothole logs with ${records.length} items`,
                    count: results.length
                });
            }

            case 'importPotholeItems': {
                // Import pothole items into existing logs
                const { records } = payload;
                if (!records || !Array.isArray(records) || records.length === 0) {
                    return NextResponse.json({ success: false, error: 'No records provided' }, { status: 400 });
                }

                // Group items by parent log ID
                const itemsByLog: Record<string, any[]> = {};
                
                for (const row of records) {
                    // Require a parent log ID (could be _id, parentId, logId, or estimate)
                    const parentId = row.parentId || row.logId || row._id;
                    if (!parentId) {
                        console.warn('Skipping item without parent ID:', row);
                        continue;
                    }
                    
                    if (!itemsByLog[parentId]) {
                        itemsByLog[parentId] = [];
                    }
                    
                    itemsByLog[parentId].push({
                        _id: row.itemId || `${parentId}-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        potholeNo: row.potholeNo || '',
                        typeOfUtility: row.typeOfUtility || '',
                        soilType: row.soilType || '',
                        topDepthOfUtility: row.topDepthOfUtility || '',
                        bottomDepthOfUtility: row.bottomDepthOfUtility || '',
                        photo1: row.photo1 || '',
                        photo2: row.photo2 || '',
                        pin: row.pin || '',
                        createdBy: row.createdBy || 'csv-import',
                        createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
                    });
                }

                let updatedCount = 0;
                let itemCount = 0;
                
                for (const [logId, items] of Object.entries(itemsByLog)) {
                    const result = await PotholeLog.findByIdAndUpdate(
                        logId,
                        { $push: { potholeItems: { $each: items } } },
                        { new: true }
                    );
                    if (result) {
                        updatedCount++;
                        itemCount += items.length;
                    }
                }

                return NextResponse.json({ 
                    success: true, 
                    message: `Added ${itemCount} items to ${updatedCount} pothole logs`,
                    count: itemCount
                });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Pothole Logs API Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '500');
        const estimate = searchParams.get('estimate');

        const filter: any = {};
        if (estimate) filter.estimate = estimate;

        const logs = await PotholeLog.find(filter)
            .sort({ date: -1 })
            .limit(limit)
            .lean();

        return NextResponse.json({ success: true, result: logs });
    } catch (error: any) {
        console.error('Pothole Logs GET Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}
