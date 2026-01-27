import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Schedule from '@/lib/models/Schedule';
import { OverheadItem } from '@/lib/models';

export async function GET() {
    try {
        await connectToDatabase();
        
        // 1. Get Overhead Items
        const overheads = await OverheadItem.find({}).lean();
        
        const getOverheadCost = (name: string) => {
             const item = overheads.find((c: any) => c.overhead?.trim().toLowerCase() === name.toLowerCase());
             return Number(item?.dailyRate) || 0;
        };

        const devcoOverhead = getOverheadCost('Devco Overhead');
        const riskFactor = getOverheadCost('Risk Factor');
        const overheadRate = devcoOverhead + riskFactor;
        
        // 2. Get Schedules with DJT
        const schedules = await Schedule.find({ djt: { $ne: null } });
        
        let updatedCount = 0;
        
        for (const schedule of schedules) {
            if (!schedule.djt) continue;
            
            let equipmentCost = 0;
            if (schedule.djt.equipmentUsed && Array.isArray(schedule.djt.equipmentUsed)) {
                schedule.djt.equipmentUsed.forEach((eq: any) => {
                    if (eq.type?.toLowerCase() === 'owned') {
                        equipmentCost += (Number(eq.qty) || 0) * (Number(eq.cost) || 0);
                    }
                });
            }
            
            const totalCost = equipmentCost + overheadRate;
            
            if (schedule.djt.djtCost !== totalCost) {
                schedule.djt.djtCost = totalCost;
                schedule.markModified('djt');
                await schedule.save();
                updatedCount++;
            }
        }
        
        return NextResponse.json({ 
            success: true, 
            updated: updatedCount, 
            overheadRate,
            message: `Updated ${updatedCount} schedules with DJT cost.` 
        });
    } catch (error: any) {
        console.error('Migration Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
