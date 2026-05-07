const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const proj = await db.collection('devcoquickbooks').findOne({ proposalNumber: '25-0631' });
  const invoices = proj.transactions.filter(t => t.transactionType === 'Invoice');
  console.log(JSON.stringify(invoices, null, 2));
  await client.close();
}
run().catch(console.error);
