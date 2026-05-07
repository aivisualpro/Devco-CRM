import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';

export async function GET() {
    await connectToDatabase();
    // 25-0631 has proposalNumber 25-0631. Let's find its projectId
    const p = await DevcoQuickBooks.findOne({ proposalNumber: '25-0631' });
    if (!p) return NextResponse.json({ error: 'not found' });
    return NextResponse.json({
        id: p.projectId,
        transactions: p.transactions
    });
}
