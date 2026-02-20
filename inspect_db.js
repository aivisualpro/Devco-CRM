const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

if(fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if(fs.existsSync('.env')) dotenv.config({ path: '.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const schedules = await mongoose.connection.collection('devcoschedules').find().sort({ createdAt: -1 }).limit(1).toArray();
  const s = schedules[0];
  let to = '7148003596';
  if(s) {
      console.log('Latest Schedule ID:', s._id);
      console.log('Title:', s.title);
      console.log('notifyAssignees:', s.notifyAssignees);
      console.log('assignees:', s.assignees);
      const emps = await mongoose.connection.collection('devcoEmployees').find({ email: { $in: s.assignees || [] } }).toArray();
      console.log('Employees phones:', emps.map(e => ({ email: e.email, phone: e.phone, mobile: e.mobile })));
      if (emps.length > 0) to = emps[0].mobile || emps[0].phone || to;
  } else {
      console.log('No schedules found');
  }

  // test send SMS
  const body = 'This is another test message from devco scheduling';
  
  const spaceUrl = 'devco.signalwire.com';
  const projectId = 'eadef30a-69af-404c-9484-2016a5821167';
  const token = 'PTc87d999a6c4ce04cb6baf7ad44b18bcd89e3c11461c46b54';
  const fromNumber = '+19517400074';

  const url = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Messages.json`;
  const encodedAuth = Buffer.from(`${projectId}:${token}`).toString('base64');

  let cleanTo = to.replace(/[^0-9+]/g, '');
  if (cleanTo.length === 10) cleanTo = `+1${cleanTo}`;
  
  console.log('Sending from', fromNumber, 'to', cleanTo);

  const res = await fetch(url, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${encodedAuth}`
      },
      body: new URLSearchParams({ From: fromNumber, To: cleanTo, Body: body })
  });

  if (!res.ok) console.error(`[SignalWire] Error sending SMS to ${cleanTo}:`, await res.text());
  else console.log('Success:', await res.json());

  process.exit(0);
}
run().catch(console.error);
