import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    const sourceUri = process.env.DEVCOAPPSHEET_MONGODB_URI;
    const targetUri = process.env.MONGODB_URI;

    if (!sourceUri || !targetUri) {
        console.error('Error: MongoDB URIs not found in .env.local');
        return;
    }

    if (sourceUri === targetUri) {
        console.error('Error: Source and Target URIs are the same. Please update MONGODB_URI to a different database.');
        return;
    }

    const sourceClient = new MongoClient(sourceUri);
    const targetClient = new MongoClient(targetUri);

    try {
        await sourceClient.connect();
        await targetClient.connect();

        const sourceDb = sourceClient.db();
        const targetDb = targetClient.db();

        console.log(`📡 Connected. Migrating from [${sourceDb.databaseName}] to [${targetDb.databaseName}]...`);

        const collections = await sourceDb.listCollections().toArray();

        for (const colDef of collections) {
            const name = colDef.name;
            if (name.startsWith('system.')) continue;

            console.log(`📦 Copying collection: ${name}...`);
            const data = await sourceDb.collection(name).find({}).toArray();

            if (data.length > 0) {
                // Clear target collection first
                await targetDb.collection(name).deleteMany({});
                // Insert new data
                await targetDb.collection(name).insertMany(data);
                console.log(`   ✅ Success: ${data.length} documents moved.`);
            } else {
                console.log(`   ℹ️ Empty collection, skipped.`);
            }
        }

        console.log('\n✨ Migration complete! All collections have been mirrored.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await sourceClient.close();
        await targetClient.close();
    }
}

migrate();
