import { NextRequest, NextResponse } from 'next/server';
import { getProjectProfitability } from '@/lib/quickbooks';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const profitability = await getProjectProfitability(id);
        return NextResponse.json(profitability);
    } catch (error: any) {
        console.error('Error in Project Profitability API:', error);
        return NextResponse.json(
            { error: 'Failed to fetch project profitability' },
            { status: 500 }
        );
    }
}
