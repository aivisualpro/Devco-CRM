import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Constant } from '@/lib/models';

const SETTINGS_TYPE = 'AppSettings';

/**
 * GET /api/app-settings?key=billingTicketAssignees
 * Returns the setting value for the given key, or all AppSettings if no key provided.
 */
export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (key) {
            const setting = await Constant.findOne({ type: SETTINGS_TYPE, value: key });
            return NextResponse.json({
                success: true,
                result: setting ? { key: setting.value, data: setting.data } : null
            });
        }

        // Return all app settings
        const settings = await Constant.find({ type: SETTINGS_TYPE });
        const mapped = settings.map(s => ({ key: s.value, data: s.data, description: s.description }));
        return NextResponse.json({ success: true, result: mapped });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/app-settings
 * Body: { key: string, data: any, description?: string }
 * Upserts the setting.
 */
export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { key, data, description } = body;

        if (!key) {
            return NextResponse.json({ success: false, error: 'Setting key is required' }, { status: 400 });
        }

        const result = await Constant.findOneAndUpdate(
            { type: SETTINGS_TYPE, value: key },
            {
                type: SETTINGS_TYPE,
                value: key,
                data,
                description: description || key,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, result: { key: result.value, data: result.data } });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
