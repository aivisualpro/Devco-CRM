require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const ClientSchema = new mongoose.Schema({
    _id: String,
    name: String,
    contacts: [{
        name: String, email: String, phone: String, type: String, active: Boolean, primary: Boolean
    }]
  }, { strict: false });
  
  ClientSchema.virtual('primaryContact').get(function() {
      if (this.contacts && this.contacts.length > 0) {
          return this.contacts.find(c => c.primary) || this.contacts.find(c => c.active) || this.contacts[0];
      }
      return null;
  });
  ClientSchema.set('toJSON', { virtuals: true });
  ClientSchema.set('toObject', { virtuals: true });
  
  const Client = mongoose.model('Client', ClientSchema, 'devcoclients');
  
  // Test 1: Fetch a client
  const client = await Client.findOne({ "contacts.0": { $exists: true } }).lean({ virtuals: true });
  if (client) {
      console.log('Client name:', client.name);
      console.log('Primary Contact Virtual (lean virtuals: true):', client.primaryContact?.name);
  } else {
      console.log('No client found');
  }
  
  process.exit(0);
}
main().catch(console.error);
