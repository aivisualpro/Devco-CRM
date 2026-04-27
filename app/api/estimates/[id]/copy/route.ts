import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: sourceId } = await params;

        // 1. Fetch Source Estimate
        const sourceEst = await Estimate.findById(sourceId).lean();
        if (!sourceEst) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

        // 2. Generate New Estimate Number (Same logic as createEstimate)
        const currentYear = new Date().getFullYear();
        const yearSuffix = currentYear.toString().slice(-2);
        const startSeq = 1;

        const regex = new RegExp(`^${yearSuffix}-`);
        const existingEstimates = await Estimate.find({ estimate: { $regex: regex } })
            .select('estimate')
            .lean();

        const usedSequences = new Set<number>();
        existingEstimates.forEach((doc: any) => {
            if (doc.estimate) {
                const parts = doc.estimate.split('-');
                if (parts.length === 2) {
                    const seq = parseInt(parts[1], 10);
                    if (!isNaN(seq)) {
                        usedSequences.add(seq);
                    }
                }
            }
        });

        let nextSeq = startSeq;
        while (usedSequences.has(nextSeq)) {
            nextSeq++;
        }

        const estimateNumber = `${yearSuffix}-${String(nextSeq).padStart(4, '0')}`;

        // 3. Create New Estimate Document
        const newId = `${estimateNumber}-V1`;

        // Remove fields we don't want to copy or that need reset
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            _id, createdAt, updatedAt, __v,
            estimate, proposalNo, versionNumber, date,
            customerName, customerId,
            contactName, contactId, contactEmail, contactPhone,
            jobAddress,
            status, ...sourceData
        } = sourceEst as any;

        const newEstData = {
            ...sourceData,
            _id: newId,
            estimate: estimateNumber,
            proposalNo: estimateNumber,
            versionNumber: 1,
            status: 'pending',
            date: new Date().toLocaleDateString(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const newEst = await Estimate.create(newEstData);

        revalidateTag('estimates-list', undefined as any);
        return NextResponse.json({ success: true, result: newEst });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
