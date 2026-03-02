import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import EquipmentInspection from '@/lib/models/EquipmentInspection';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            case 'getAll': {
                const { limit = 500 } = payload || {};
                const results = await EquipmentInspection.find()
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();
                return NextResponse.json({ success: true, result: results });
            }

            case 'getById': {
                const { id } = payload;
                if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
                const doc = await EquipmentInspection.findById(id).lean();
                if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'create': {
                const { item } = payload;
                if (!item) return NextResponse.json({ success: false, error: 'Item required' }, { status: 400 });
                const doc = await EquipmentInspection.create(item);
                return NextResponse.json({ success: true, result: doc });
            }

            case 'update': {
                const { id, item } = payload;
                if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

                const updated = await EquipmentInspection.findByIdAndUpdate(id, { $set: item }, { new: true }).lean();
                if (!updated) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'delete': {
                const { id } = payload;
                if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
                await EquipmentInspection.findByIdAndDelete(id);
                return NextResponse.json({ success: true, message: 'Deleted' });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Equipment Inspection API Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
