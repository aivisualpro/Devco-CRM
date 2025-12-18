import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Client, Employee, Constant, Estimate } from '@/lib/models';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;

        await connectToDatabase();

        switch (action) {
            case 'getSchedules': {
                const results = await Schedule.find().sort({ fromDate: -1 }).lean();
                return NextResponse.json({ success: true, result: results });
            }

            case 'getScheduleById': {
                const { id } = payload || {};
                const result = await Schedule.findById(id).lean();
                return NextResponse.json({ success: true, result });
            }

            case 'createSchedule': {
                const doc = await Schedule.create({
                    ...payload,
                    _id: payload.recordId, // Using recordId as _id
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'updateSchedule': {
                const { id, ...data } = payload || {};
                const result = await Schedule.findByIdAndUpdate(
                    id,
                    { ...data, updatedAt: new Date() },
                    { new: true }
                );
                return NextResponse.json({ success: true, result });
            }

            case 'deleteSchedule': {
                const { id } = payload || {};
                await Schedule.findByIdAndDelete(id);
                return NextResponse.json({ success: true });
            }

            case 'importSchedules': {
                const { schedules } = payload || {};
                if (!Array.isArray(schedules)) return NextResponse.json({ success: false, error: 'Invalid array' });

                const ops = schedules.map((item: any) => ({
                    updateOne: {
                        filter: { _id: item.recordId },
                        update: {
                            $set: { ...item, _id: item.recordId },
                            $setOnInsert: { createdAt: new Date() }
                        },
                        upsert: true
                    }
                }));

                const result = await Schedule.bulkWrite(ops);
                return NextResponse.json({ success: true, result });
            }

            case 'getInitialData': {
                const [clients, employees, constants, estimates] = await Promise.all([
                    Client.find().select('name _id').lean(),
                    Employee.find().select('firstName lastName email').lean(),
                    Constant.find().lean(),
                    Estimate.find({ status: { $ne: 'deleted' } }).select('estimate _id').lean()
                ]);

                return NextResponse.json({
                    success: true,
                    result: {
                        clients: Array.from(new Map(clients.filter(c => c?._id).map(c => [c._id.toString(), c])).values()),
                        employees: Array.from(new Map(employees.filter(e => e?.email).map(e => [e.email, { value: e.email, label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email }])).values()),
                        constants: Array.from(new Map(constants.filter(c => c?.type && c?.description).map(c => [`${c.type}-${c.description}`, c])).values()),
                        estimates: Array.from(new Set(estimates.map(e => e.estimate).filter(Boolean))).sort().map(est => ({ value: est, label: est }))
                    }
                });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
