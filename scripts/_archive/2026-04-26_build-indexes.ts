import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

import dbConnect from '../lib/db';
import * as models from '../lib/models';

async function buildIndexes() {
  console.log('Connecting to database...');
  await dbConnect();
  console.log('Connected to database.');

  for (const [name, Model] of Object.entries(models)) {
    if (Model && typeof (Model as any).syncIndexes === 'function') {
      try {
        console.log(`\n[${name}] Syncing indexes...`);
        // syncIndexes() builds missing indexes and optionally drops indexes 
        // that are no longer defined in the schema.
        const result = await (Model as any).syncIndexes();
        console.log(`[${name}] Done. Current indexes:`, result);
      } catch (error: any) {
        console.error(`[${name}] Error syncing indexes:`, error.message);
      }
    }
  }

  console.log('\nFinished building all database indexes.');
  process.exit(0);
}

buildIndexes().catch((err) => {
  console.error('Fatal error during index build:', err);
  process.exit(1);
});
