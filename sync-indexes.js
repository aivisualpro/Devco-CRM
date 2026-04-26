require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');
  
  const ScheduleSchema = new mongoose.Schema({}, { strict: false });
  // Add indexes to match
  ScheduleSchema.index({ fromDate: -1 });
  ScheduleSchema.index({ projectManager: 1 });
  ScheduleSchema.index({ foremanName: 1 });
  ScheduleSchema.index({ assignees: 1 });
  ScheduleSchema.index({ fromDate: 1, assignees: 1 });
  ScheduleSchema.index({ customerId: 1, scheduledDate: -1 });
  ScheduleSchema.index({ estimate: 1 });
  ScheduleSchema.index({ scheduledDate: -1 });
  ScheduleSchema.index({ status: 1 });
  
  const Schedule = mongoose.model('Schedule', ScheduleSchema, 'devcoschedules');
  await Schedule.syncIndexes();
  console.log('Indexes synced!');
  process.exit(0);
}
main().catch(console.error);
