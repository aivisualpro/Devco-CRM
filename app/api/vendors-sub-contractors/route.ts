import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VendorsSubContractors from '@/lib/models/VendorsSubContractors';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        switch (action) {

            case 'getAll': {
                const docs = await VendorsSubContractors.find().sort({ name: 1 }).lean();
                return NextResponse.json({ success: true, result: docs });
            }

            case 'getById': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                const doc = await VendorsSubContractors.findById(id).lean();
                if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'create': {
                const { type, name, address, contacts, createdBy } = payload || {};
                if (!type || !name) {
                    return NextResponse.json({ success: false, error: 'type and name are required' }, { status: 400 });
                }
                const doc = await VendorsSubContractors.create({
                    type, name, address: address || '', contacts: contacts || [], createdBy: createdBy || ''
                });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'update': {
                const { id, ...updates } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                const doc = await VendorsSubContractors.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
                if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'delete': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                await VendorsSubContractors.findByIdAndDelete(id);
                return NextResponse.json({ success: true, message: 'Deleted' });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('VendorsSubContractors API Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
