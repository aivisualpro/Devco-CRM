import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/db';
import { Customization } from '../lib/models';

const SEED_TEMPLATES = [
    {
        key: 'schedule_sms_notification',
        label: 'Schedule SMS Notification',
        category: 'sms',
        enabled: true,
        template: 'DEVCOERP: You have been assigned to "{{title}}" at {{jobLocation}}. Date: {{fromDate}} – {{toDate}}. PM: {{projectManager}}, Foreman: {{foremanName}}.',
        variables: [
            'title',
            'fromDate',
            'toDate',
            'customerName',
            'jobLocation',
            'projectManager',
            'foremanName',
            'service',
            'description',
            'fringe',
            'certifiedPayroll',
            'perDiem',
            'employeeName',
        ]
    }
];

async function seed() {
    console.log('Connecting to database...');
    await connectToDatabase();
    
    console.log('Checking for existing customizations...');
    const count = await Customization.countDocuments();
    
    if (count === 0) {
        console.log('No customizations found. Seeding initial data...');
        await Customization.insertMany(SEED_TEMPLATES);
        console.log('Seed successful!');
    } else {
        console.log(`Found ${count} customizations. Skipping seed.`);
    }

    mongoose.disconnect();
    console.log('Done.');
}

seed().catch(console.error);
