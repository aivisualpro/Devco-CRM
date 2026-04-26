import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Template } from '@/lib/models';

// Helper to normalize services (trim, unique, sorted)
function normalizeServices(services: any): string[] {
    if (!Array.isArray(services)) return [];
    const unique = Array.from(new Set(services.map((s: any) => String(s).trim()).filter(Boolean)));
    return unique.sort();
}

// Helper to check for template service conflicts
async function checkTemplateServicesConflict(services: string[], excludeId?: string) {
    if (!services || services.length === 0) return null;

    const conflict = await Template.findOne({
        services: { $size: services.length, $all: services },
        ...(excludeId ? { _id: { $ne: excludeId } } : {})
    }).lean();

    return conflict;
}

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const items = await Template.find().sort({ createdAt: -1 });
                return NextResponse.json({ success: true, result: items });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const item = body || {};
                const services = normalizeServices(item.services);

                const conflict = await checkTemplateServicesConflict(services);
                if (conflict) {
                    return NextResponse.json({
                        success: false,
                        error: `Service conflict: The template "${(conflict as any).title}" already uses this exact set of services.`
                    }, { status: 200 }); // Return 200 to avoid red console errors, UI handles success: false
                }

                const newTemplate = await Template.create({ ...item, services });
                return NextResponse.json({ success: true, result: newTemplate });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
