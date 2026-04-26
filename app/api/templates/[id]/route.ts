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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: tempId } = await params;
        const tempItem = await req.json();
                if (!tempId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                if (tempItem.services) {
                    const services = normalizeServices(tempItem.services);
                    const conflict = await checkTemplateServicesConflict(services, tempId);
                    if (conflict) {
                        return NextResponse.json({
                            success: false,
                            error: `Service conflict: The template "${(conflict as any).title}" already uses this exact set of services.`
                        }, { status: 200 }); // Return 200 to avoid red console errors
                    }
                    tempItem.services = services;
                }

                const updated = await Template.findByIdAndUpdate(tempId, { ...tempItem, updatedAt: new Date() }, { new: true });
                return NextResponse.json({ success: true, result: updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: tempDelId } = await params;
                if (!tempDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Template.findByIdAndDelete(tempDelId);
                return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
