import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

/**
 * ONE-TIME migration: Set isRequiredDJT and isRequiredJHA to false
 * for all schedules where item ≠ "Day Off".
 *
 * GET /api/migrate-isRequired
 * DELETE this file after running.
 */
export async function GET() {
    try {
        await connectToDatabase();
        const { default: Schedule } = await import('@/lib/models/Schedule');

        const result = await Schedule.updateMany(
            { item: { $ne: 'Day Off' } },
            { $set: { isRequiredDJT: false, isRequiredJHA: false } }
        );

        return NextResponse.json({
            success: true,
            matched: result.matchedCount,
            modified: result.modifiedCount,
            message: `Set isRequiredDJT=false & isRequiredJHA=false on ${result.modifiedCount} non-Day Off schedules`
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
