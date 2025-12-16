import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';

export async function GET(request: Request) {
    try {
        await connectToDatabase();
        const id = 'EST-1765880101167-yi223dxp7';

        const estimate: any = await Estimate.findById(id).lean();

        return NextResponse.json({
            success: true,
            estimate: estimate || 'Not Found',
            laborItems: estimate?.labor || [],
            laborCount: estimate?.labor?.length || 0
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack });
    }
}
