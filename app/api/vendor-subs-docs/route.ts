import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VendorSubsDoc from '@/lib/models/VendorSubsDoc';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        switch (action) {

            case 'getVendorSubsDocs': {
                const { estimate } = payload || {};
                if (!estimate) return NextResponse.json({ success: false, error: 'estimate is required' }, { status: 400 });
                const docs = await VendorSubsDoc.find({ estimate }).sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: docs });
            }

            case 'createVendorSubsDoc': {
                const { estimate, type, vendorSubName, fileName, files, createdBy } = payload || {};
                if (!estimate || !type || !vendorSubName || !fileName) {
                    return NextResponse.json({ success: false, error: 'estimate, type, vendorSubName and fileName are required' }, { status: 400 });
                }
                const doc = await VendorSubsDoc.create({ estimate, type, vendorSubName, fileName, files: files || [], createdBy: createdBy || '' });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'updateVendorSubsDoc': {
                const { id, ...updates } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                const doc = await VendorSubsDoc.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
                if (!doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'deleteVendorSubsDoc': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                await VendorSubsDoc.findByIdAndDelete(id);
                return NextResponse.json({ success: true, message: 'Deleted' });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Vendor Subs Docs API Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
