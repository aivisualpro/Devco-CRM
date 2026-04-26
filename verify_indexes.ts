import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const uri = process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env.local");

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection failed: db is undefined");
  const collections = ['clients', 'employees', 'estimates', 'tasks'];
  const results: any = {};
  
  for (const collName of collections) {
    try {
      const coll = db.collection(collName);
      const indexes = await coll.indexes();
      results[collName] = indexes;
    } catch (e: any) {
      results[collName] = e.message;
    }
  }
  
  console.log(JSON.stringify(results, null, 2));
  await mongoose.disconnect();
}

main().catch(console.error);
