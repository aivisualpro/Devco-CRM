import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Constant } from '@/lib/models';

const SETTINGS_TYPE = 'AppSettings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        
        const settings = await Constant.find({ type: SETTINGS_TYPE });
        
        // Convert array of settings into a single key-value object
        const settingsMap: Record<string, any> = {};
        for (const s of settings) {
            if (s.value) {
                settingsMap[s.value as string] = s.data;
            }
        }

        return NextResponse.json({ 
            success: true, 
            result: settingsMap 
        }, {
            headers: {
                'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { settings } = body;

        if (!settings || typeof settings !== 'object') {
            return NextResponse.json({ success: false, error: 'Settings object is required' }, { status: 400 });
        }

        const updates = [];
        for (const [key, data] of Object.entries(settings)) {
            updates.push(
                Constant.findOneAndUpdate(
                    { type: SETTINGS_TYPE, value: key },
                    {
                        type: SETTINGS_TYPE,
                        value: key,
                        data,
                        description: key,
                        updatedAt: new Date()
                    },
                    { upsert: true, new: true }
                )
            );
        }

        await Promise.all(updates);

        return NextResponse.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
