import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Estimate, EstimateLineItemsLabor } from '@/lib/models';

async function check() {
    await connectToDatabase();
    const id = 'EST-1765880101167-yi223dxp7';
    console.log('Checking estimate:', id);
    const est = await Estimate.findById(id);
    console.log('Estimate found:', !!est);
    if (est) {
        console.log('Estimate _id type:', typeof est._id);
        console.log('Estimate _id value:', est._id);
    }

    const labor = await EstimateLineItemsLabor.find({ estimateId: id });
    console.log('Labor items count:', labor.length);
    console.log('Labor items:', JSON.stringify(labor, null, 2));
    process.exit(0);
}

check();
