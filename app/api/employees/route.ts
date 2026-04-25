import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
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
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex },
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
            ? { score: { $meta: 'textScore' as const }, ...(sort || { firstName: 1, lastName: 1 }) }
            : (sort || { firstName: 1, lastName: 1 });
        // Ensure stable sorting by appending _id if not present
        if (!appliedSort._id) {
            appliedSort._id = 1;
        }

        let findQuery = Employee.find(query).select('-password -refreshToken -__v');
        if (useTextSearch) {
            findQuery = findQuery.select({ score: { $meta: 'textScore' } });
        }

        const [items, total, totalActive, totalInactive] = await Promise.all([
            findQuery
                .sort(appliedSort as any)
                .skip(skip)
                .limit(limit)
                .lean(),
            Employee.countDocuments(baseQuery),
            Employee.countDocuments({ ...baseQuery, status: 'Active' }),
            Employee.countDocuments({ ...baseQuery, status: { $nin: ['Active', 'deleted'] } })
        ]);

        const response = buildPaginationResponse(items as any, total, page, limit);
        (response as any).counts = {
            all: total,
            active: totalActive,
            inactive: totalInactive
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }
}
