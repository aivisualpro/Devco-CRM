const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const count = await db.collection('devcoEmployees').countDocuments();
  console.log('Total employees:', count);
  
  const indexes = await db.collection('devcoEmployees').indexes();
  console.log('Indexes:', indexes);

  process.exit(0);
}
run();
