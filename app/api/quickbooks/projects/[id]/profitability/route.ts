import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectToDatabase();
        const { id } = await params;

        const project = await DevcoQuickBooks.findOne({ projectId: id });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const transactions = (project as any).transactions || [];
        let income = 0;
        let cost = 0;

        transactions.forEach((t: any) => {
            const amount = t.amount || 0;
            if (t.transactionType?.toLowerCase() === 'invoice') {
                income += amount;
            } else {
                cost += amount;
            }
        });

        const profitability = {
            income,
            cost,
            profitMargin: income > 0 ? Math.round(((income - cost) / income) * 100) : 0
        };

        return NextResponse.json(profitability);
    } catch (error: any) {
        console.error('Error in Project Profitability API (MongoDB):', error);
        return NextResponse.json(
            { error: 'Failed to fetch project profitability' },
            { status: 500 }
        );
    }
}
