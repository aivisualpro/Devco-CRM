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

        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const project = await DevcoQuickBooks.findOne({ projectId: id });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Map MongoDB transactions to the format expected by the UI
        const formattedTransactions = project.transactions.map((tx: any) => ({
            id: tx.transactionId,
            date: tx.date,
            type: tx.transactionType,
            no: tx.transactionId.split('-').pop(), // Fallback for "No." field
            from: tx.fromTo,
            memo: tx.memo,
            amount: tx.amount,
            status: tx.transactionType?.toLowerCase() === 'invoice' ? 'Open' : 'Paid', // Dummy logic for UI
            statusColor: tx.transactionType?.toLowerCase() === 'invoice' ? 'amber' : 'emerald'
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(formattedTransactions);
    } catch (error: any) {
        console.error('Error in project transactions API (MongoDB):', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}
