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

        const project = await DevcoQuickBooks.findOne({ projectId: id });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const transactions = (project as any).transactions || [];
        let income = 0;
        let qbCost = 0;

        transactions.forEach((t: any) => {
            const amount = t.amount || 0;
            if (t.transactionType?.toLowerCase() === 'invoice') {
                income += amount;
            } else {
                qbCost += amount;
            }
        });

        let devcoCost = 0;
        let jobTickets: any[] = [];

        if (project.proposalNumber) {
            // Get overhead items for calculations
            const overheads = await OverheadItem.find({}).lean();
            const getOverheadCost = (name: string) => {
                const item = overheads.find((c: any) => (c.overhead || '').trim().toLowerCase() === name.toLowerCase());
                return Number(item?.dailyRate) || 0;
            };
            const overheadRate = getOverheadCost('Devco Overhead') + getOverheadCost('Risk Factor');

            // Get all schedules for the project
            const schedules = await Schedule.find({
                estimate: project.proposalNumber
            }).lean();

            const scheduleIds = schedules.map(s => String(s._id));
            
            // Get all standalone DJTs for these schedules to ensure we don't miss any
            const standaloneDjts = await DailyJobTicket.find({
                schedule_id: { $in: scheduleIds }
            }).lean();

            // Create a map for easy lookup
            const djtMap = new Map();
            standaloneDjts.forEach(d => djtMap.set(String(d.schedule_id), d));

            jobTickets = schedules.map(s => {
                // Use nested djt or standalone djt
                const djt = (s as any).djt || djtMap.get(String(s._id));
                if (!djt) return null;

                const equipmentUsed = djt.equipmentUsed || [];
                // ONLY count 'owned' equipment for Devco internal cost.
                // Rental equipment is captured in QuickBooks transactions (qbCost).
                const eqCost = equipmentUsed.reduce((sum: number, eq: any) => {
                    if (eq.type?.toLowerCase() !== 'owned') return sum;
                    const cost = Number(eq.cost) || 0;
                    const qty = Number(eq.qty) || 0; // Default to 0 for internal cost if not set
                    return sum + (cost * qty);
                }, 0);
                
                // totalTicketCost should be the recorded djtCost OR (eq + overhead)
                const recordedTotal = Number(djt.djtCost) || 0;
                
                let finalTotal = 0;
                let ovCost = 0;

                if (recordedTotal > 0) {
                    finalTotal = recordedTotal;
                    // If djtCost is provided, it covers everything.
                    // Overhead is the remaining portion after equipment.
                    ovCost = Math.max(0, recordedTotal - eqCost);
                } else {
                    // Fallback to auto-calc: Owned Equipment + Standard Overhead
                    ovCost = overheadRate;
                    finalTotal = eqCost + ovCost;
                }
                
                devcoCost += finalTotal;
                
                return {
                    id: djt._id,
                    schedule_id: s._id,
                    date: s.fromDate || djt.createdAt,
                    equipmentCost: eqCost,
                    overheadCost: ovCost,
                    totalCost: finalTotal,
                    djtData: {
                        ...djt,
                        scheduleRef: s // Attach schedule info for the modal
                    }
                };
            }).filter(Boolean).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        const totalCost = qbCost + devcoCost;

        console.log(`Profitability Calc for ${id}: Income=${income}, QBCost=${qbCost}, DevcoCost=${devcoCost}, Tickets=${jobTickets.length}`);

        const profitability = {
            income,
            qbCost,
            devcoCost,
            totalCost,
            profitMargin: income > 0 ? Math.round(((income - totalCost) / income) * 100) : 0,
            jobTickets
        };

        return NextResponse.json(profitability);
    } catch (error: any) {
        console.error('Error in Project Profitability API (MongoDB):', error);
        return NextResponse.json(
            { error: 'Failed to fetch project profitability' },
            { status: 500 }
        );
    }
}
