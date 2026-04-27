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

        // 2. Determine Next Version
        const allVersions = await Estimate.find({ estimate: sourceEst.estimate })
            .select('versionNumber')
            .lean();

        // Build a set of existing version numbers
        const existingVersions = new Set(allVersions.map((v: any) => v.versionNumber).filter(n => typeof n === 'number'));

        // Find the first missing number starting from 1
        let nextVersion = 1;
        while (existingVersions.has(nextVersion)) {
            nextVersion++;
        }
        let newId = `${sourceEst.estimate}-V${nextVersion}`;

        // Collision Detection Loop: Ensure we don't hit a duplicate ID
        while (await Estimate.exists({ _id: newId })) {
            nextVersion++;
            newId = `${sourceEst.estimate}-V${nextVersion}`;
        }

        // 3. Create New Estimate Document
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, createdAt, updatedAt, __v, ...sourceData } = sourceEst as any;

        const newEstData = {
            ...sourceData,
            _id: newId,
            versionNumber: nextVersion,
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
