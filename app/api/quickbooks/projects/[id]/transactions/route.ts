import { NextRequest, NextResponse } from 'next/server';
import { getProjectTransactions } from '@/lib/quickbooks';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';

export const maxDuration = 60;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

        // ── Step 1: Try MongoDB cache first (instant, <10ms) ──
        if (!forceRefresh) {
            try {
                await connectToDatabase();
                const cached = await DevcoQuickBooks.findOne(
                    { projectId: id },
                    { transactions: 1, updatedAt: 1 }
                ).lean();

                if (cached && cached.transactions && cached.transactions.length > 0) {
                    // Map MongoDB field names → frontend field names
                    const mapped = cached.transactions.map((t: any) => ({
                        id: t.transactionId || t._id?.toString(),
                        date: t.date,
                        type: t.transactionType,
                        no: t.no || '',
                        from: t.fromTo,
                        memo: t.memo || '',
                        amount: t.amount || 0,
                        status: t.status || 'Paid',
                        statusColor: (t.status || '').toLowerCase() === 'paid' ? 'emerald' : 
                                     (t.status || '').toLowerCase() === 'open' ? 'amber' : 'emerald'
                    }));

                    // Sort by date descending (same as live QB)
                    mapped.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    console.log(`[QB-TX] Served ${mapped.length} transactions from MongoDB cache for project ${id}`);
                    return NextResponse.json(mapped, {
                        headers: { 'X-Data-Source': 'mongodb-cache', 'X-Cache-Date': cached.updatedAt?.toISOString() || '' }
                    });
                }
            } catch (dbErr) {
                console.warn('[QB-TX] MongoDB cache miss/error, falling back to live QB:', dbErr);
            }
        }

        // ── Step 2: Fetch LIVE from QuickBooks (slow, 3-10s) ──
        console.log(`[QB-TX] Cache miss for project ${id}, fetching live from QuickBooks...`);
        const transactions = await getProjectTransactions(id);

        // ── Step 3: Background-save to MongoDB for next time ──
        try {
            await connectToDatabase();
            await DevcoQuickBooks.findOneAndUpdate(
                { projectId: id },
                {
                    $set: {
                        transactions: transactions.map((t: any) => ({
                            transactionId: t.id,
                            date: t.date ? new Date(t.date) : new Date(),
                            transactionType: t.type,
                            split: '',
                            fromTo: t.from,
                            projectId: id,
                            amount: t.amount,
                            memo: t.memo,
                            status: t.status || 'Paid',
                            no: t.no || ''
                        }))
                    }
                },
                { upsert: true }
            );
            console.log(`[QB-TX] Cached ${transactions.length} transactions to MongoDB for project ${id}`);
        } catch (saveErr) {
            console.warn('[QB-TX] Failed to cache transactions to MongoDB:', saveErr);
        }

        return NextResponse.json(transactions, {
            headers: { 'X-Data-Source': 'quickbooks-live' }
        });
    } catch (error: any) {
        console.error('Error in project transactions API:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}
