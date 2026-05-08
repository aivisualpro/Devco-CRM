import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { parsePagination, parseSearch, buildPaginationResponse } from '@/lib/api/pagination';
import { uploadImage, processEmployeeSubDocFiles } from '@/lib/employeeUploadUtils';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { createNotifications } from '@/lib/notifications';
import { atlasSearch, atlasSearchCount, AtlasSearchField } from '@/lib/atlasSearch';

const EMPLOYEE_SEARCH_FIELDS: AtlasSearchField[] = [
    { path: 'firstName', boost: 5 },
    { path: 'lastName', boost: 5 },
    { path: 'email', boost: 3 },
    { path: 'phone', boost: 2 },
    { path: 'mobile', boost: 2 },
    { path: 'appRole', boost: 1 },
    { path: 'companyPosition', boost: 1 },
    { path: 'designation', boost: 1 },
    { path: 'recordId', boost: 2 },
    { path: 'address', boost: 1 },
    { path: 'city', boost: 1 },
];

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();

        const { page, limit, skip, sort } = parsePagination(req);
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');
        const status = searchParams.get('status');
        const hasSearch = q && q.trim() !== '';
        const trimmed = hasSearch ? q.trim() : '';

        const statusFilter: any = { status: { $ne: 'deleted' } };
        if (status) {
            if (status === 'Active') {
                statusFilter.status = 'Active';
            } else if (status === 'Inactive') {
                statusFilter.status = { $nin: ['Active', 'deleted'] };
            } else {
                statusFilter.status = status;
            }
        }

        // Map client-side column keys to actual MongoDB field paths
        let appliedSort: any;
        if (sort) {
            if (sort['name'] !== undefined) {
                appliedSort = { firstName: sort['name'], lastName: sort['name'] };
            } else if (sort['recordId'] !== undefined) {
                // 'recordId' is stored as string — sort numerically via aggregation
                const dir = sort['recordId'];
                const query = { ...statusFilter };
                const baseQuery = { status: { $ne: 'deleted' } };
                if (hasSearch) {
                    // For recordId sort with search, use regex filter in aggregation
                    const searchRegex = { $regex: trimmed, $options: 'i' };
                    const searchableFields = ['firstName', 'lastName', 'email', 'recordId', 'phone', 'mobile', 'appRole', 'companyPosition', 'designation'];
                    (query as any).$or = searchableFields.map(field => ({ [field]: searchRegex }));
                    (baseQuery as any).$or = (query as any).$or;
                }
                const [items, total, totalActive, totalInactive] = await Promise.all([
                    Employee.aggregate([
                        { $match: query },
                        { $addFields: { recordIdNum: { $toInt: { $ifNull: ['$recordId', '0'] } } } },
                        { $sort: { recordIdNum: dir, _id: 1 } },
                        { $skip: skip },
                        { $limit: limit },
                        { $project: { password: 0, refreshToken: 0, __v: 0 } }
                    ]),
                    Employee.countDocuments(baseQuery),
                    Employee.countDocuments({ ...baseQuery, status: 'Active' }),
                    Employee.countDocuments({ ...baseQuery, status: { $nin: ['Active', 'deleted'] } })
                ]);
                const response = buildPaginationResponse(items as any, total, page, limit);
                (response as any).counts = { all: total, active: totalActive, inactive: totalInactive };
                return NextResponse.json(response);
            } else {
                appliedSort = sort;
            }
        } else {
            appliedSort = { firstName: 1, lastName: 1 };
        }

        if (!appliedSort._id) appliedSort._id = 1;

        let items: any[];
        let total: number;

        if (hasSearch) {
            // Use Atlas Search (with automatic regex fallback)
            const [searchResult, countResult] = await Promise.all([
                atlasSearch({
                    model: Employee,
                    query: trimmed,
                    fields: EMPLOYEE_SEARCH_FIELDS,
                    postFilter: statusFilter,
                    limit,
                    skip,
                    sort: appliedSort,
                    fuzzyMaxEdits: 1,
                }),
                atlasSearchCount(Employee, trimmed, EMPLOYEE_SEARCH_FIELDS, statusFilter),
            ]);
            items = searchResult.items;
            total = countResult;
        } else {
            // No search — standard find
            const query = { ...statusFilter };
            let findQuery = Employee.find(query).select('-password -refreshToken -__v');
            [items, total] = await Promise.all([
                findQuery.sort(appliedSort).skip(skip).limit(limit).lean(),
                Employee.countDocuments(query),
            ]);
        }

        const baseCountFilter = { status: { $ne: 'deleted' } as any };
        const [totalActive, totalInactive] = await Promise.all([
            Employee.countDocuments({ ...baseCountFilter, status: 'Active' }),
            Employee.countDocuments({ ...baseCountFilter, status: { $nin: ['Active', 'deleted'] } })
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

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const item = await req.json();
                if (!item || !item.email) return NextResponse.json({ success: false, error: 'Missing employee data or email' }, { status: 400 });
                let profilePictureUrl = item.profilePicture;
                if (item.profilePicture && item.profilePicture.startsWith('data:image')) {
                    const uploaded = await uploadImage(item.profilePicture, item.email);
                    if (uploaded) profilePictureUrl = uploaded;
                }
                let signatureUrl = item.signature;
                if (item.signature && item.signature.startsWith('data:image')) {
                    const uploaded = await uploadImage(item.signature, `${item.email}_signature`);
                    if (uploaded) signatureUrl = uploaded;
                }
                // Upload any base64 files in sub-document arrays to R2
                await processEmployeeSubDocFiles(item, item.email);
                const employeeData = { ...item, _id: item.email, profilePicture: profilePictureUrl, signature: signatureUrl };
                const newEmployee = await Employee.create(employeeData) as any;

                // --- Notifications ---
                Promise.resolve().then(async () => {
                    try {
                        const jwtUser = await getUserFromRequest(req);
                        const adminDocs = await Employee.find({ appRole: { $regex: /^(super admin|admin)$/i }, status: 'Active' }).select('email').lean();
                        const adminEmails = adminDocs.map((e: any) => e.email?.toLowerCase().trim()).filter(Boolean);
                        
                        const currentUserEmail = jwtUser?.email?.toLowerCase().trim() || '';
                        const filteredEmails = adminEmails.filter((e: string) => e !== currentUserEmail);

                        if (filteredEmails.length > 0) {
                            await createNotifications({
                                recipientEmails: filteredEmails,
                                type: 'general',
                                title: `New Employee Created`,
                                message: `${(jwtUser as any)?.firstName || 'Someone'} added a new employee: ${newEmployee.firstName} ${newEmployee.lastName}`,
                                link: `/employees/${newEmployee._id}`
                            });
                        }
                    } catch (err) {
                        console.error('[notif]', err);
                    }
                });

                return NextResponse.json({ success: true, result: newEmployee });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
