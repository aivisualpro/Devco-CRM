import { connectToDatabase } from './lib/db';
import { Schedule } from './lib/models';

async function fix() {
    await connectToDatabase();
    console.log('Creating index on Schedule.estimate...');
    await Schedule.collection.createIndex({ estimate: 1 });
    console.log('Index created successfully!');
    process.exit(0);
}
fix();
