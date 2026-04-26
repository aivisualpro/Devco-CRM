import mongoose from 'mongoose';
import { connectToDatabase } from './lib/db';
import Schedule from './lib/models/Schedule';

async function main() {
  await connectToDatabase();
  console.log('Syncing Schedule indexes...');
  await Schedule.syncIndexes();
  console.log('Done!');
  process.exit(0);
}
main();
