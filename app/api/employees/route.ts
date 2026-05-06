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

        if (q && q.trim() !== '') {
            const trimmed = q.trim();
            const searchRegex = { $regex: trimmed, $options: 'i' };
            const searchableFields = [
                'firstName', 'lastName', 'email', 'recordId', 'phone', 'mobile',
                'appRole', 'companyPosition', 'designation', 'groupNo', 'driverLicense',
                'ssNumber', 'address', 'city', 'state', 'zip'
            ];
            baseQuery.$or = searchableFields.map(field => ({ [field]: searchRegex }));
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

        // Map client-side column keys to actual MongoDB field paths
        let appliedSort: any;
        if (sort) {
            // 'name' column sorts by firstName then lastName
            if (sort['name'] !== undefined) {
                appliedSort = { firstName: sort['name'], lastName: sort['name'] };
            }
            // 'recordId' is stored as string — sort numerically via aggregation
            else if (sort['recordId'] !== undefined) {
                const dir = sort['recordId'];
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

        let findQuery = Employee.find(query).select('-password -refreshToken -__v');

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
