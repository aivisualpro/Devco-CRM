#!/usr/bin/env node
/**
 * scripts/metric-preflight.mjs
 *
 * Pre-flight check: every metricId prop used in JSX/TSX must have a
 * matching entry in metricCatalog.ts. Run as part of CI or before deploy.
 *
 * Exit 0 = all IDs are documented.
 * Exit 1 = one or more IDs are missing from the catalog.
 *
 * Usage:
 *   node scripts/metric-preflight.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../');

// ── 1. Collect all catalog IDs from metricCatalog.ts ─────────────────────────

const catalogSrc = readFileSync(join(ROOT, 'lib/financials/metricCatalog.ts'), 'utf8');
const catalogIds = new Set(
    [...catalogSrc.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]),
);
console.log(`\n✅  Catalog contains ${catalogIds.size} metric IDs.\n`);

// ── 2. Walk all TSX/TS files and extract metricId="…" props ──────────────────

function walk(dir, files = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, files);
        else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
    }
    return files;
}

const sourceFiles = walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')));

const usedIds = new Map(); // id → [file, ...]

for (const file of sourceFiles) {
    const src = readFileSync(file, 'utf8');
    const relative = file.replace(ROOT, '').replace(/^\//, '');
    for (const m of src.matchAll(/metricId=["']([^"']+)["']/g)) {
        const id = m[1];
        if (!usedIds.has(id)) usedIds.set(id, []);
        usedIds.get(id).push(relative);
    }
}

console.log(`🔍  Found ${usedIds.size} unique metricId values across the codebase.\n`);

// ── 3. Find mismatches ────────────────────────────────────────────────────────

const missing = [];
for (const [id, files] of usedIds) {
    if (!catalogIds.has(id)) {
        missing.push({ id, files });
    }
}

// ── 4. Report ─────────────────────────────────────────────────────────────────

if (missing.length === 0) {
    console.log('✅  PRE-FLIGHT PASSED — every metricId is documented in the catalog.\n');
    process.exit(0);
} else {
    console.error('❌  PRE-FLIGHT FAILED — the following metricId values have NO catalog entry:\n');
    for (const { id, files } of missing) {
        console.error(`   • "${id}"`);
        for (const f of files) console.error(`       └─ ${f}`);
    }
    console.error('\n   Add these IDs to lib/financials/metricCatalog.ts before deploying.\n');
    process.exit(1);
}
