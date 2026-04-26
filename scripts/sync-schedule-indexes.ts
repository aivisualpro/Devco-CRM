import { connectToDatabase } from '../lib/db';
import { Schedule } from '../lib/models';

async function main() {
  await connectToDatabase();
  const result = await Schedule.syncIndexes();
  console.log('Schedule indexes synced:', result);
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
