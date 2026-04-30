import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoFringeCost } from '@/lib/models';

export async function GET() {
    try {
        await connectToDatabase();
        const records = await DevcoFringeCost.find({}).sort({ fromDate: -1 });
        return NextResponse.json({ success: true, result: records });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();

        if (body.action === 'create') {
            const { type, fromDate, toDate, cost } = body.payload;

            // Validate required fields
            if (!type || !fromDate || !toDate || cost === undefined) {
                return NextResponse.json({ success: false, error: 'All fields are required' }, { status: 400 });
            }

            const from = new Date(fromDate);
            const to = new Date(toDate);

            if (from >= to) {
                return NextResponse.json({ success: false, error: 'From date must be before To date' }, { status: 400 });
            }

            // Check for overlapping date ranges for the same type
            const overlap = await DevcoFringeCost.findOne({
                type,
                $or: [
                    // New range starts within existing range
                    { fromDate: { $lte: from }, toDate: { $gte: from } },
                    // New range ends within existing range
                    { fromDate: { $lte: to }, toDate: { $gte: to } },
                    // New range completely encompasses existing range
                    { fromDate: { $gte: from }, toDate: { $lte: to } },
                ]
            });

            if (overlap) {
                return NextResponse.json({
                    success: false,
                    error: `Date range overlaps with existing entry: ${new Date(overlap.fromDate).toLocaleDateString()} – ${new Date(overlap.toDate).toLocaleDateString()}`,
                    overlap: true
                }, { status: 409 });
            }

            const record = await DevcoFringeCost.create({
                type,
                fromDate: from,
                toDate: to,
                cost: parseFloat(cost)
            });

            return NextResponse.json({ success: true, result: record });
        }

        if (body.action === 'update') {
            const { _id, ...updateData } = body.payload;
            const result = await DevcoFringeCost.findByIdAndUpdate(_id, updateData, { new: true });
            return NextResponse.json({ success: true, result });
        }

        if (body.action === 'delete') {
            const result = await DevcoFringeCost.findByIdAndDelete(body.payload._id);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
