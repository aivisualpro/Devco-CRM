import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Usa811Ticket } from '@/lib/models';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;

        await connectToDatabase();

        switch (action) {
            case 'getTickets': {
                const { search, sortKey = 'requestDate', sortDir = 'desc', page = 1, limit = 100 } = payload || {};
                const filter: any = {};

                if (search) {
                    const s = search.trim();
                    filter.$or = [
                        { ticketNo: { $regex: s, $options: 'i' } },
                        { address: { $regex: s, $options: 'i' } },
                        { city: { $regex: s, $options: 'i' } },
                        { county: { $regex: s, $options: 'i' } },
                        { projectName: { $regex: s, $options: 'i' } },
                        { estimate: { $regex: s, $options: 'i' } },
                        { callerName: { $regex: s, $options: 'i' } },
                        { excavator: { $regex: s, $options: 'i' } },
                        { status: { $regex: s, $options: 'i' } },
                    ];
                }

                const sort: any = { [sortKey]: sortDir === 'asc' ? 1 : -1 };
                const skip = (page - 1) * limit;

                const [results, total] = await Promise.all([
                    Usa811Ticket.find(filter).sort(sort).skip(skip).limit(limit).lean(),
                    Usa811Ticket.countDocuments(filter),
                ]);

                return NextResponse.json({ success: true, result: results, total });
            }

            case 'createTicket': {
                const ticket = await Usa811Ticket.create(payload);
                return NextResponse.json({ success: true, result: ticket });
            }

            case 'updateTicket': {
                const { id, ...updates } = payload;
                const updated = await Usa811Ticket.findByIdAndUpdate(id, updates, { new: true }).lean();
                if (!updated) {
                    return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
                }
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteTicket': {
                const { id } = payload;
                await Usa811Ticket.findByIdAndDelete(id);
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[USA 811 Tickets API Error]', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
