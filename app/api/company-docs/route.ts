import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoCompanyDoc } from '@/lib/models';

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        const docs = await DevcoCompanyDoc.find().sort({ createdAt: -1 });
        return NextResponse.json({ success: true, docs });
    } catch (error: any) {
        console.error('Error fetching docs:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch docs' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { title, url, type, uploadedBy } = body;

        if (!title || !url) {
            return NextResponse.json({ success: false, error: 'Title and URL are required' }, { status: 400 });
        }

        const newDoc = await DevcoCompanyDoc.create({
            title,
            url,
            type: type || 'document',
            uploadedBy
        });

        return NextResponse.json({ success: true, doc: newDoc });
    } catch (error: any) {
        console.error('Error creating doc:', error);
        return NextResponse.json({ success: false, error: 'Failed to create doc' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        await DevcoCompanyDoc.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting doc:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete doc' }, { status: 500 });
    }
}
