import fs from 'fs';
import path from 'path';

const modelsDir = path.join(process.cwd(), 'lib/models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

for (const file of files) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    
    // Extract schema fields
    const schemaMatch = content.match(/new\s+(?:mongoose\.)?Schema\s*\(\s*\{([\s\S]*?)\}\s*(?:,|\))/);
    if (!schemaMatch) continue;
    
    const fields = new Set<string>();
    const schemaBody = schemaMatch[1];
    
    // Very naive extraction, just look for keys before colons at first level indentation (approximate)
    const lines = schemaBody.split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
        if (match) {
            fields.add(match[1]);
        }
    }
    
    // Extract indexes
    const indexMatches = content.matchAll(/\.index\s*\(\s*\{([\s\S]*?)\}/g);
    for (const match of indexMatches) {
        const indexStr = match[1];
        const indexFields = indexStr.split(',').map(s => s.split(':')[0].trim().replace(/['"]/g, ''));
        
        for (const field of indexFields) {
            if (!fields.has(field) && field !== '' && !field.includes('.')) {
                console.log(`[WARNING] Model: ${file} | Index field '${field}' not found in schema definition.`);
            }
        }
    }
}
console.log('Audit complete.');
