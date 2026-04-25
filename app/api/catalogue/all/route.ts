import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { EquipmentItem, LaborItem, MaterialItem, OverheadItem, SubcontractorItem, DisposalItem, MiscellaneousItem, ToolItem } from '@/lib/models';

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const [
                    equipment,
                    labor,
                    material,
                    overhead,
                    subcontractor,
                    disposal,
                    miscellaneous,
                    tools,
                    constants
                ] = await Promise.all([
                    EquipmentItem.find().sort({ createdAt: -1 }).lean(),
                    LaborItem.find().sort({ createdAt: -1 }).lean(),
                    MaterialItem.find().sort({ createdAt: -1 }).lean(),
                    OverheadItem.find().sort({ createdAt: -1 }).lean(),
                    SubcontractorItem.find().sort({ createdAt: -1 }).lean(),
                    DisposalItem.find().sort({ createdAt: -1 }).lean(),
                    MiscellaneousItem.find().sort({ createdAt: -1 }).lean(),
                    ToolItem.find().sort({ createdAt: -1 }).lean(),
                    Constant.find().sort({ createdAt: -1 }).lean()
                ]);

                return NextResponse.json({
                    success: true,
                    result: {
                        equipment,
                        labor,
                        material,
                        overhead,
                        subcontractor,
                        disposal,
                        miscellaneous,
                        tools,
                        constant: constants
                    }
                });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
