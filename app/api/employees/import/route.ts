import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const payload = await req.json();
        const { employees } = payload || {};
                if (!Array.isArray(employees)) return NextResponse.json({ success: false, error: 'Invalid employees array' }, { status: 400 });
                const parseNum = (val: any) => {
                    const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
                    return isNaN(parsed) ? 0 : parsed;
                };
                const operations = employees.map((e: any) => {
                    if (!e.email) return null;
                    let scheduleActive = e.isScheduleActive;
                    if (typeof scheduleActive === 'string') {
                        const val = scheduleActive.trim().toUpperCase();
                        scheduleActive = ['YES', 'Y', 'TRUE', '1'].includes(val);
                    }
                    const rateSite = e.hourlyRateSITE ? parseNum(e.hourlyRateSITE) : 0;
                    const rateDrive = e.hourlyRateDrive ? parseNum(e.hourlyRateDrive) : 0;
                    const { _id, isScheduleActive, hourlyRateSITE, hourlyRateDrive, ...rest } = e;
                    const finalUpdate = { ...rest, isScheduleActive: scheduleActive, hourlyRateSITE: rateSite, hourlyRateDrive: rateDrive, email: e.email, updatedAt: new Date() };
                    return {
                        updateOne: {
                            filter: { _id: e.email },
                            update: { $set: finalUpdate, $setOnInsert: { _id: e.email, createdAt: new Date() } },
                            upsert: true
                        }
                    };
                }).filter(Boolean);
                const result = await Employee.bulkWrite(operations as any);
                revalidateTag('permissions-all', undefined as any);
                return NextResponse.json({ success: true, result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
