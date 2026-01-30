
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await connectToDatabase();
        
        const body = await req.json();
        const updateData: any = {};
        const unsetData: any = {};
        
        // Handle Original Contract Manual Override
        if (body.originalContract !== undefined) {
             if (body.originalContract === null || body.originalContract === '') {
                 // Revert to calculated value by unsetting the manual override
                 unsetData.manualOriginalContract = "";
             } else {
                 updateData.manualOriginalContract = parseFloat(body.originalContract);
             }
        }

        // Handle Change Orders Manual Override
        if (body.changeOrders !== undefined) {
             if (body.changeOrders === null || body.changeOrders === '') {
                 // Revert to calculated value by unsetting the manual override
                 unsetData.manualChangeOrders = "";
             } else {
                 updateData.manualChangeOrders = parseFloat(body.changeOrders);
             }
        }
        
        const updateQuery: any = {};
        if (Object.keys(updateData).length > 0) updateQuery.$set = updateData;
        if (Object.keys(unsetData).length > 0) updateQuery.$unset = unsetData;
        
        if (Object.keys(updateQuery).length === 0) {
            return NextResponse.json({ success: true, message: 'No changes provided' });
        }

        const result = await DevcoQuickBooks.findOneAndUpdate(
            { projectId: id },
            updateQuery,
            { new: true }
        );

        if (!result) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, project: result });
    } catch (error: any) {
        console.error('Error updating project manual values:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
