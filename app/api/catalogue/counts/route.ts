import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { EquipmentItem, LaborItem, MaterialItem, OverheadItem, SubcontractorItem, DisposalItem, MiscellaneousItem, ToolItem, Constant } from '@/lib/models';

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
                    EquipmentItem.countDocuments(),
                    LaborItem.countDocuments(),
                    MaterialItem.countDocuments(),
                    OverheadItem.countDocuments(),
                    SubcontractorItem.countDocuments(),
                    DisposalItem.countDocuments(),
                    MiscellaneousItem.countDocuments(),
                    ToolItem.countDocuments(),
                    Constant.countDocuments()
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
