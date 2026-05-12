import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: sourceId } = await params;

        // 1. Fetch Source Version
        const sourceEst = await Estimate.findById(sourceId).lean();
        if (!sourceEst) return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });

        // 2. Determine Next Change Order Number for this version
        // IDs are formatted as Estimate-V[num]-CO[num]
        const regex = new RegExp(`^${sourceId}-CO([0-9]+)$`);
        const existingCOs = await Estimate.find({ _id: { $regex: regex } })
            .select('_id')
            .lean();

        let nextCO = 1;
        const usedCONumbers = existingCOs.map((co: any) => {
            const match = co._id.match(regex);
            return match ? parseInt(match[1], 10) : 0;
        });

        if (usedCONumbers.length > 0) {
            nextCO = Math.max(...usedCONumbers) + 1;
        }

        const newId = `${sourceId}-CO${nextCO}`;

        // 3. Create New Change Order Document
        // copy ONLY header info, NOT line items or proposals as requested
        const {
            _id, createdAt, updatedAt, __v,
            labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous,
            proposals, proposal,
            ...headerData
        } = sourceEst as any;

        const newCOData = {
            ...headerData,
            _id: newId,
            isChangeOrder: true,
            parentVersionId: sourceId,
            status: 'Pending',
            // Initialize empty arrays
            labor: [],
            equipment: [],
            material: [],
            tools: [],
            overhead: [],
            subcontractor: [],
            disposal: [],
            miscellaneous: [],
            proposals: [],

            date: new Date().toLocaleDateString(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const newCO = await Estimate.create(newCOData);

        revalidateTag('schedule-counts', undefined as any);
        revalidateTag('wip-calculations', undefined as any);
        return NextResponse.json({ success: true, result: newCO });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
