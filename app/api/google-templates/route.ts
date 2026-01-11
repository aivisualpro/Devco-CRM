import { NextRequest, NextResponse } from 'next/server';
import { listGoogleDocsTemplates } from '@/lib/googleService';

export async function GET(req: NextRequest) {
    try {
        const files = await listGoogleDocsTemplates();
        return NextResponse.json({ success: true, files });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
