import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Client, Estimate, Employee } from '@/lib/models';
import { parsePagination, parseSearch, buildPaginationResponse } from '@/lib/api/pagination';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { createNotifications } from '@/lib/notifications';
import { atlasSearch, atlasSearchCount, AtlasSearchField } from '@/lib/atlasSearch';

const CLIENT_SEARCH_FIELDS: AtlasSearchField[] = [
    { path: 'name', boost: 5 },
    { path: 'contacts.name', boost: 3 },
    { path: 'contacts.email', boost: 2 },
    { path: 'contacts.phone', boost: 1 },
    { path: 'businessEmail', boost: 2 },
];

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();

        const { searchParams } = new URL(req.url);
        let { page, limit, skip, sort } = parsePagination(req);

        // Allow larger limits for lite requests (dropdowns)
        if (searchParams.get('lite') === 'true' && searchParams.get('limit')) {
            limit = parseInt(searchParams.get('limit') as string, 10) || limit;
            skip = (page - 1) * limit;
        }

        const q = searchParams.get('q');
        const status = searchParams.get('status');
        const hasSearch = q && q.trim() !== '';
        const trimmed = hasSearch ? q.trim() : '';

        // Build status filter (applied as postFilter in Atlas Search, or merged in regex)
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

        const appliedSort: any = sort || { name: 1 };
        if (!appliedSort._id) appliedSort._id = 1;

        const isLite = searchParams.get('lite') === 'true';
        const selectFields = isLite
            ? { name: 1, _id: 1 }
            : undefined; // full doc

        let items: any[];
        let total: number;

        if (hasSearch) {
            // Use Atlas Search (with automatic regex fallback)
            const [searchResult, countResult] = await Promise.all([
                atlasSearch({
                    model: Client,
                    query: trimmed,
                    fields: CLIENT_SEARCH_FIELDS,
                    postFilter: statusFilter,
                    project: selectFields,
                    limit,
                    skip,
                    sort: appliedSort,
                    fuzzyMaxEdits: 1,
                }),
                atlasSearchCount(Client, trimmed, CLIENT_SEARCH_FIELDS, statusFilter),
            ]);
            items = searchResult.items;
            total = countResult;
        } else {
            // No search query — standard find
            const query = { ...statusFilter };
            let findQuery = Client.find(query);
            if (isLite) findQuery = findQuery.select('name _id');

            [items, total] = await Promise.all([
                findQuery.sort(appliedSort).skip(skip).limit(limit).lean(),
                Client.countDocuments(query),
            ]);
        }

        // Count active/inactive for tabs (use base filter without status)
        const baseCountFilter: any = hasSearch
            ? undefined // skip expensive counts during search
            : { status: { $ne: 'deleted' } };

        const [totalActive, totalInactive] = baseCountFilter
            ? await Promise.all([
                Client.countDocuments({ ...baseCountFilter, status: 'Active' }),
                Client.countDocuments({ ...baseCountFilter, status: { $nin: ['Active', 'deleted'] } }),
            ])
            : [0, 0];

        let finalItems = items;
        
        // Skip expensive estimate counting if lite mode is requested
        
        if (!isLite) {
            // Fetch unique estimates count for each client
            finalItems = await Promise.all(
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
        }

        const response = buildPaginationResponse(finalItems as any, total, page, limit);
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

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const item = await req.json();
                if (!item) return NextResponse.json({ success: false, error: 'Missing client data' }, { status: 400 });

                const contacts: any[] = [];
                const inputContacts = Array.isArray(item.contacts) ? item.contacts : [];

                inputContacts.forEach((con: any, idx: number) => {
                    contacts.push({
                        ...con,
                        type: con.type || 'Main Contact',
                        active: con.active !== undefined ? con.active : (idx === 0),
                        primary: con.primary !== undefined ? con.primary : (idx === 0)
                    });
                });

                // Migrate legacy main contact info
                if (item.contactFullName || item.email || item.phone) {
                    const exists = contacts.some(con => con.name === item.contactFullName);
                    if (!exists) {
                        contacts.push({
                            name: item.contactFullName || 'Primary Contact',
                            email: item.email || '',
                            phone: item.phone || '',
                            type: 'Main Contact',
                            active: contacts.length === 0,
                            primary: contacts.length === 0
                        });
                    }
                }

                // Migrate legacy accounting info
                if (item.accountingContact || item.accountingEmail) {
                    const exists = contacts.some(con => con.name === item.accountingContact && con.type === 'Accounting');
                    if (!exists) {
                        contacts.push({
                            name: item.accountingContact || 'Accounting Contact',
                            email: item.accountingEmail || '',
                            type: 'Accounting',
                            active: contacts.length === 0,
                            primary: false
                        });
                    }
                }

                // Ensure exactly one is active AND one is primary
                if (contacts.length > 0) {
                    if (!contacts.some(con => con.active)) contacts[0].active = true;
                    if (!contacts.some(con => con.primary)) contacts[0].primary = true;
                }

                // Handle addresses
                let addresses = Array.isArray(item.addresses) ? item.addresses : [];
                addresses = addresses.map((addr: any, idx: number) => {
                    if (typeof addr === 'string') {
                        return { address: addr, primary: idx === 0 };
                    }
                    return addr;
                });

                // Sync businessAddress with primary address
                const primaryAddr = addresses.find((a: any) => a.primary) || addresses[0];
                const businessAddress = primaryAddr ? (typeof primaryAddr === 'string' ? primaryAddr : primaryAddr.address) : item.businessAddress || '';

                const clientData = {
                    ...item,
                    contacts,
                    addresses,
                    businessAddress,
                    _id: item.recordId || item._id || `C-${Date.now()}`
                };
                delete (clientData as any).accountingContact;
                delete (clientData as any).accountingEmail;
                delete (clientData as any).contactFullName;
                delete (clientData as any).email;
                delete (clientData as any).phone;

                // Get current user for createdBy
                const jwtUser = await getUserFromRequest(req);
                if (jwtUser?.email) {
                    clientData.createdBy = jwtUser.email;
                }

                const newClient = await Client.create(clientData) as any;

                // --- Notifications ---
                Promise.resolve().then(async () => {
                    try {
                        // Look up the creator's Employee record to get the real name
                        let creatorName = 'Someone';
                        let creatorImage = '';
                        if (jwtUser?.email) {
                            const creatorDoc = await Employee.findOne({ email: { $regex: new RegExp(`^${jwtUser.email}$`, 'i') } }).select('firstName lastName profilePicture image').lean() as any;
                            if (creatorDoc) {
                                creatorName = `${creatorDoc.firstName || ''} ${creatorDoc.lastName || ''}`.trim() || 'Someone';
                                creatorImage = creatorDoc.profilePicture || creatorDoc.image || '';
                            }
                        }

                        const adminDocs = await Employee.find({ appRole: { $regex: /^(super admin|admin)$/i }, status: 'Active' }).select('email').lean();
                        const adminEmails = adminDocs.map((e: any) => e.email?.toLowerCase().trim()).filter(Boolean);
                        
                        const currentUserEmail = jwtUser?.email?.toLowerCase().trim() || '';
                        const filteredEmails = adminEmails.filter((e: string) => e !== currentUserEmail);

                        if (filteredEmails.length > 0) {
                                await createNotifications({
                                    recipientEmails: filteredEmails,
                                    type: 'general',
                                    title: newClient.name,
                                    message: `A new client has been created by ${creatorName}`,
                                    link: `/clients/${newClient._id}`,
                                    metadata: {
                                        creatorName,
                                        creatorImage
                                    },
                                    createdBy: jwtUser?.email || ''
                                });
                        }
                    } catch (err) {
                        console.error('[notif]', err);
                    }
                });

                return NextResponse.json({ success: true, result: newClient });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
