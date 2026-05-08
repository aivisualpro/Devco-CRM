import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ChartConfig } from '@/lib/models';

export async function GET() {
    try {
        await connectToDatabase();
        const charts = await ChartConfig.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
        return NextResponse.json({ success: true, charts });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const { action, payload } = body;

        switch (action) {
            case 'create': {
                const chart = await ChartConfig.create(payload);
                return NextResponse.json({ success: true, chart });
            }
            case 'update': {
                const { id, ...update } = payload;
                const chart = await ChartConfig.findByIdAndUpdate(id, update, { new: true }).lean();
                if (!chart) return NextResponse.json({ success: false, error: 'Chart not found' }, { status: 404 });
                return NextResponse.json({ success: true, chart });
            }
            case 'delete': {
                await ChartConfig.findByIdAndDelete(payload.id);
                return NextResponse.json({ success: true });
            }
            case 'reorder': {
                // payload.orders = [{ id, order }]
                const bulkOps = payload.orders.map((o: any) => ({
                    updateOne: { filter: { _id: o.id }, update: { $set: { order: o.order } } }
                }));
                await ChartConfig.bulkWrite(bulkOps);
                return NextResponse.json({ success: true });
            }
            case 'getAll': {
                // Admin view — includes inactive charts
                const charts = await ChartConfig.find({}).sort({ order: 1, createdAt: 1 }).lean();
                return NextResponse.json({ success: true, charts });
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
