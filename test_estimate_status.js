const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("No MONGODB_URI"); return; }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('devco'); // or default
  const estimates = await db.collection('estimatesdb').find({ estimate: { $regex: '0000' } }).toArray();
  console.log(JSON.stringify(estimates.map(e => ({ _id: e._id, estimate: e.estimate, status: e.status })), null, 2));
  await client.close();
}
run();
