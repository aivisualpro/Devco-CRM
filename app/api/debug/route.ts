
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate, EstimateLineItemsLabor } from '@/lib/models';

export async function GET(request: Request) {
    try {
        await connectToDatabase();
        const id = 'EST-1765880101167-yi223dxp7';

        const estimate = await Estimate.findById(id).lean();
        const labor = await EstimateLineItemsLabor.find({ estimateId: id }).lean();

        return NextResponse.json({
            success: true,
            estimate: estimate || 'Not Found',
            laborItems: labor,
            laborCount: labor.length
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack });
    }
}
