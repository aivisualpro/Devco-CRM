import { connectToDatabase } from './lib/db';
import { DevcoQuickBooks } from './lib/models';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
    await connectToDatabase();
    const p = await DevcoQuickBooks.findOne({ proposalNumber: '25-0631' });
    if (!p) {
        console.log('not found');
        process.exit(1);
    }
    console.log(JSON.stringify(p.transactions, null, 2));
    process.exit(0);
}

run();
