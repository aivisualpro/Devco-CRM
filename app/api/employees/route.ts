import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { parsePagination, parseSearch, buildPaginationResponse } from '@/lib/api/pagination';
import { uploadImage, processEmployeeSubDocFiles } from '@/lib/employeeUploadUtils';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { createNotifications } from '@/lib/notifications';

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
