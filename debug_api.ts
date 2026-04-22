import { connectToDatabase } from './lib/db';
import { DevcoQuickBooks } from './lib/models';

async function test() {
    await connectToDatabase();
    console.log('Fetching...');
    const projects = await DevcoQuickBooks.find({}, { projectId: 1, project: 1 }).lean();
    console.log('Total projects in DevcoQuickBooks:', projects.length);
    process.exit(0);
}
test();
