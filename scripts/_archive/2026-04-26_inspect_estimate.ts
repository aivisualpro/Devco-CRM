
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Estimate from '@/lib/models/Estimate';

async function inspect() {
    try {
        await connectToDatabase();
        console.log('Connected. Fetching latest estimate...');
        const latest = await Estimate.findOne({ 
            $or: [
                { estimate: { $regex: '0000' } },
                { projectName: { $regex: 'Devco Misc' } }
            ]
        }).lean();
        if (latest) {
            console.log('Latest Estimate ID:', latest.estimate);
            console.log('Custom Variables:', (latest as any).customVariables);
            
            if (latest.proposals && latest.proposals.length > 0) {
                 const lastProp = latest.proposals[latest.proposals.length - 1];
                 console.log('Last Proposal Custom Pages:', JSON.stringify(lastProp.customPages, null, 2));
            }
        } else {
            console.log('No estimates found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

inspect();
