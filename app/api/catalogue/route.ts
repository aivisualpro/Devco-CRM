import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { EquipmentItem, LaborItem, MaterialItem, OverheadItem, SubcontractorItem, DisposalItem, MiscellaneousItem, ToolItem, Constant } from '@/lib/models';
import { uploadImage } from '@/lib/employeeUploadUtils';

function getCatalogueModel(type: string) {
    const models: Record<string, typeof EquipmentItem> = {
        equipment: EquipmentItem,
        labor: LaborItem,
        material: MaterialItem,
        overhead: OverheadItem,
        subcontractor: SubcontractorItem,
        disposal: DisposalItem,
        miscellaneous: MiscellaneousItem,
        tools: ToolItem,
        constant: Constant as unknown as typeof EquipmentItem
    };
    return models[type];
}

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');
                if (!type) return NextResponse.json({ success: false, error: 'Missing type' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const items = await Model.find().sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: items });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const { type, item } = await req.json();
                if (!type || !item) return NextResponse.json({ success: false, error: 'Missing type or item' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const newItem = await Model.create(item);
                return NextResponse.json({ success: true, result: newItem });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        await connectToDatabase();
        const { type, id: catId, item } = await req.json();
                if (!type || !catId) return NextResponse.json({ success: false, error: 'Missing type or id' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const updated = await Model.findByIdAndUpdate(catId, { ...item, updatedAt: new Date() }, { new: true }).lean();
                return NextResponse.json({ success: true, result: updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await connectToDatabase();
        const { type, id: catDelId } = await req.json();
                if (!type || !catDelId) return NextResponse.json({ success: false, error: 'Missing type or id' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                await Model.findByIdAndDelete(catDelId);
                return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
