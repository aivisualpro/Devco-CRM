import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { connectToDatabase } from './lib/db';
import { qboQuery } from './lib/quickbooks';

async function test() {
    try {
        console.log('Querying QuickBooks for project IDs...');
        
        await connectToDatabase();
        const { DevcoQuickBooks } = await import('./lib/models');
        const projects = await DevcoQuickBooks.find({});
        console.log(`Found ${projects.length} projects in DB`);
        const target = projects.find(p => p.project.includes("26-0002"));
        if (target) {
            console.log(`DB TARGET: projectId=${target.projectId}, project=${target.project}, customer=${target.customer}`);
        } else {
            console.log("Target '26-0002' not found in DB");
        }

        process.exit(0);
    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    }
}

test();
