import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectToDatabase();
        const { id } = await params;
        const body = await request.json();
        const { proposalNumber } = body;

        if (proposalNumber === undefined) {
            return NextResponse.json({ error: 'proposalNumber is required' }, { status: 400 });
        }

        const project = await DevcoQuickBooks.findOneAndUpdate(
            { projectId: id },
            { $set: { proposalNumber } },
            { new: true }
        );

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Look up the new contract amount (computed)
        const { default: Estimate } = await import('@/lib/models/Estimate');
        const estimate = await Estimate.findOne({ estimate: proposalNumber }, { grandTotal: 1 });
        const contractAmount = estimate?.grandTotal || 0;

        return NextResponse.json({ success: true, project, contractAmount });
    } catch (error: any) {
        console.error('Error updating proposal number:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
