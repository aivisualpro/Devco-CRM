import mongoose from 'mongoose';
import { connectToDatabase } from './lib/db';
import { DevcoQuickBooks } from './lib/models';

async function check() {
    await connectToDatabase();
    const count = await DevcoQuickBooks.countDocuments();
    console.log('DevcoQuickBooks count:', count);
    process.exit(0);
}

check();
