import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Customization } from '@/lib/models';

// Default seed data – inserted on first GET if the collection is empty
const SEED_TEMPLATES = [
    {
        key: 'schedule_sms_notification',
        label: 'Schedule SMS Notification',
        category: 'sms',
        enabled: true,
        template: 'DEVCOERP: You have been assigned to "{{title}}" at {{jobLocation}}. Date: {{fromDate}} – {{toDate}}. PM: {{projectManager}}, Foreman: {{foremanName}}.',
        variables: [
            'title',
            'fromDate',
            'toDate',
            'customerName',
            'jobLocation',
            'projectManager',
            'foremanName',
            'service',
            'description',
            'fringe',
            'certifiedPayroll',
            'perDiem',
            'employeeName',
        ]
    }
];

export async function GET() {
    try {
        await connectToDatabase();

        let results = await Customization.find().sort({ category: 1, label: 1 }).lean();

        // Auto-seed if empty
        if (results.length === 0) {
            await Customization.insertMany(SEED_TEMPLATES);
            results = await Customization.find().sort({ category: 1, label: 1 }).lean();
        }

        return NextResponse.json({ success: true, result: results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        let result;
        switch (action) {
            case 'update': {
                const { _id, ...update } = payload;
                result = await Customization.findByIdAndUpdate(_id, { ...update, updatedAt: new Date() }, { new: true });
                break;
            }
            case 'create': {
                result = await Customization.create(payload);
                break;
            }
            case 'delete': {
                result = await Customization.findByIdAndDelete(payload._id);
                break;
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
