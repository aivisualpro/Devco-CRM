import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Template } from '@/lib/models';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: cloneId } = await params;
                if (!cloneId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const original = await Template.findById(cloneId).lean();
                if (!original) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                const { _id, createdAt, updatedAt, ...rest } = original as any;

                // When cloning, we clear services to avoid immediate uniqueness conflict
                const newTemplate = await Template.create({
                    ...rest,
                    title: `${rest.title} (Copy)`,
                    services: [], // Clear services as per uniqueness rule
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return NextResponse.json({ success: true, result: newTemplate });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
