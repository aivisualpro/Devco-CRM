import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Client, Estimate } from '@/lib/models';
import { parsePagination, parseSearch, buildPaginationResponse } from '@/lib/api/pagination';

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();

        const { page, limit, skip, sort } = parsePagination(req);
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');
        const status = searchParams.get('status');

        let baseQuery: any = { status: { $ne: 'deleted' } };
        let useTextSearch = false;

        if (q && q.trim() !== '') {
            const trimmed = q.trim();
            if (trimmed.length >= 3) {
                // Use $text index for efficient full-text search
                baseQuery.$text = { $search: trimmed };
                useTextSearch = true;
            } else {
                // Fallback to $regex for very short queries (1-2 chars)
                const searchRegex = { $regex: trimmed, $options: 'i' };
                baseQuery.$or = [
                    { name: searchRegex },
                    { 'contacts.name': searchRegex },
                    { 'contacts.email': searchRegex },
                    { 'contacts.phone': searchRegex }
                ];
            }
        }

        let query = { ...baseQuery };
        if (status) {
            if (status === 'Active') {
                query.status = 'Active';
            } else if (status === 'Inactive') {
                query.status = { $nin: ['Active', 'deleted'] };
            } else {
                query.status = status;
            }
        }

        const appliedSort: any = useTextSearch
            ? { score: { $meta: 'textScore' as const }, ...(sort || { name: 1 }) }
            : (sort || { name: 1 });
        // Ensure stable sorting by appending _id if not present
        if (!appliedSort._id) {
            appliedSort._id = 1;
        }

        let findQuery = Client.find(query);
        if (useTextSearch) {
            findQuery = findQuery.select({ score: { $meta: 'textScore' } });
        }

        const [items, total, totalActive, totalInactive] = await Promise.all([
            findQuery
                .sort(appliedSort as any)
                .skip(skip)
                .limit(limit)
                .lean(),
            Client.countDocuments(baseQuery),
            Client.countDocuments({ ...baseQuery, status: 'Active' }),
            Client.countDocuments({ ...baseQuery, status: { $nin: ['Active', 'deleted'] } })
        ]);

        // Fetch unique estimates count for each client
        const itemsWithCounts = await Promise.all(
            items.map(async (client: any) => {
                const uniqueEstimates = await Estimate.distinct('estimate', {
                    customerId: client._id,
                    isChangeOrder: { $ne: true }
                });
                return {
                    ...client,
                    estimatesCount: uniqueEstimates.length
                };
            })
        );

        const response = buildPaginationResponse(itemsWithCounts as any, total, page, limit);
        (response as any).counts = {
            all: total,
            active: totalActive,
            inactive: totalInactive
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching clients:', error);
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }
}
