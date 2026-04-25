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

                const newClient = await Client.create(clientData);



                return NextResponse.json({ success: true, result: newClient });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
