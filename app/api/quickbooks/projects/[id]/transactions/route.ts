import { NextRequest, NextResponse } from 'next/server';
import { getProjectTransactions } from '@/lib/quickbooks';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const transactions = await getProjectTransactions(id);
        return NextResponse.json(transactions);
    } catch (error: any) {
        console.error('Error in project transactions API:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}
