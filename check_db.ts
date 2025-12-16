import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';

async function check() {
    await connectToDatabase();
    const id = 'EST-1765880101167-yi223dxp7';
    console.log('Checking estimate:', id);
    const est: any = await Estimate.findById(id).lean();
    console.log('Estimate found:', !!est);
    if (est) {
        console.log('Estimate _id type:', typeof est._id);
        console.log('Estimate _id value:', est._id);
        console.log('Labor items count:', est.labor?.length || 0);
        console.log('Labor items:', JSON.stringify(est.labor || [], null, 2));
    } else {
        console.log('Estimate not found');
    }

    process.exit(0);
}

check();
