import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks, Schedule, OverheadItem, DailyJobTicket } from '@/lib/models';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectToDatabase();
        const { id } = await params;
        const t0 = Date.now();

        // 1. Use aggregation to compute income/qbCost server-side instead of
        //    pulling the entire transactions array to the app server.
        //    Also fetch proposalNumber in the same query (no full doc needed).
        const [aggResult] = await DevcoQuickBooks.aggregate([
            { $match: { projectId: id } },
            {
                $project: {
                    proposalNumber: 1,
                    income: { $ifNull: ['$income', 0] },
                    qbCost: { $ifNull: ['$qbCost', 0] }
                }
            }
        ]);

        if (!aggResult) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { income, qbCost, proposalNumber } = aggResult;
        const t1 = Date.now();

        let devcoCost = 0;
        let jobTickets: any[] = [];

        if (proposalNumber) {
            // 2. Run overhead + schedule queries in parallel.
            //    For Schedule, only select _id, fromDate, and the equipment portion of djt.
            const [overheads, schedules] = await Promise.all([
                OverheadItem.find({}).lean(),
                Schedule.find({ estimate: proposalNumber })
                    .select('_id fromDate title customerName estimate djt')
                    .lean()
            ]);

            const getOverheadCost = (name: string) => {
                const item = overheads.find((c: any) => (c.overhead || '').trim().toLowerCase() === name.toLowerCase());
                return Number(item?.dailyRate) || 0;
            };
            const overheadRate = getOverheadCost('Devco Overhead') + getOverheadCost('Risk Factor');

            const scheduleIds = schedules.map(s => String(s._id));
            const t2 = Date.now();

            // 3. Get standalone DJTs — only the fields needed for cost calculation + minimal display
            const standaloneDjts = await DailyJobTicket.find({
                schedule_id: { $in: scheduleIds }
            })
            .select('_id schedule_id equipmentUsed date createdAt dailyJobDescription customerPrintName customerSignature djtCost djtimages signatures createdBy')
            .lean();

            const t3 = Date.now();

            // Create a map for easy lookup
            const djtMap = new Map();
            standaloneDjts.forEach(d => djtMap.set(String(d.schedule_id), d));

            jobTickets = schedules.map(s => {
                const djt = djtMap.get(String(s._id));
                if (!djt) return null;

                const equipmentUsed = djt.equipmentUsed || [];
                const eqCost = equipmentUsed.reduce((sum: number, eq: any) => {
                    if (eq.type?.toLowerCase() !== 'owned') return sum;
                    const cost = Number(eq.cost) || 0;
                    const qty = Number(eq.qty) || 0;
                    return sum + (cost * qty);
                }, 0);

                const ovCost = overheadRate;
                const finalTotal = eqCost + ovCost;
                devcoCost += finalTotal;

                return {
                    id: djt._id,
                    schedule_id: s._id,
                    date: s.fromDate || djt.createdAt,
                    equipmentCost: eqCost,
                    overheadCost: ovCost,
                    totalCost: finalTotal,
                    djtData: {
                        _id: djt._id,
                        schedule_id: String(s._id),
                        fromDate: s.fromDate,
                        dailyJobDescription: djt.dailyJobDescription,
                        customerPrintName: djt.customerPrintName,
                        customerSignature: djt.customerSignature,
                        equipmentUsed: djt.equipmentUsed,
                        djtCost: djt.djtCost || finalTotal,
                        djtimages: djt.djtimages || [],
                        signatures: djt.signatures || [],
                        createdBy: djt.createdBy,
                        createdAt: djt.createdAt,
                        scheduleRef: { _id: s._id, fromDate: s.fromDate, title: s.title, customerName: s.customerName, estimate: s.estimate }
                    }
                };
            }).filter(Boolean).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            console.log(`[WIP Profitability ${id}] agg=${t1-t0}ms sched+oh=${t2-t1}ms djt=${t3-t2}ms total=${Date.now()-t0}ms tickets=${jobTickets.length}`);
        } else {
            console.log(`[WIP Profitability ${id}] agg=${t1-t0}ms (no proposal) total=${Date.now()-t0}ms`);
        }

        const totalCost = qbCost + devcoCost;

        const profitability = {
            income,
            qbCost,
            devcoCost,
            totalCost,
            profitMargin: income > 0 ? Math.round(((income - totalCost) / income) * 100) : 0,
            jobTickets
        };

        return NextResponse.json(profitability, {
            headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' }
        });
    } catch (error: any) {
        console.error('Error in Project Profitability API (MongoDB):', error);
        return NextResponse.json(
            { error: 'Failed to fetch project profitability' },
            { status: 500 }
        );
    }
}
