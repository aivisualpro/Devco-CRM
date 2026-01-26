import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Constant } from '@/lib/models';

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const types = searchParams.get('types'); // Comma separated

        let filter: any = {};
        if (type) {
            filter.type = type;
        } else if (types) {
             filter.type = { $in: types.split(',') };
        }

        const constants = await Constant.find(filter).sort({ value: 1 });
        return NextResponse.json({ success: true, result: constants });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        
        let result;
        if (body.action === 'update') {
            const { _id, ...updateData } = body.payload;
            result = await Constant.findByIdAndUpdate(_id, updateData, { new: true });
        } else if (body.action === 'create') {
            result = await Constant.create(body.payload);
        } else if (body.action === 'delete') {
            result = await Constant.findByIdAndDelete(body.payload._id);
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
