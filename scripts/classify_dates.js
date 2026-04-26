const fs = require('fs');

const input = fs.readFileSync('/tmp/date_inventory.txt', 'utf8');
const lines = input.split('\n').filter(Boolean);

let output = '# Date Migration Inventory\n\n';

for (const line of lines) {
    if (line.includes('node_modules')) continue;
    if (line.match(/val\.toLocaleString|\.toLocaleString\(/) && !line.includes('Date')) {
        // likely number formatting
        output += `[BUCKET C] ${line}\n`;
        continue;
    }

    let bucket = 'A'; // default to A

    if (line.match(/createdAt|updatedAt|uploadedAt|processedAt|receivedAt|readAt|expiresAt|lastSent/)) {
        bucket = 'B';
    } else if (line.match(/\.toLocaleString\(/) && line.includes('America/Los_Angeles')) {
        bucket = 'B';
    } else if (line.match(/reduce\(/) || line.match(/total\./) || line.match(/Amount\./) || line.match(/\.toLocaleString\(/)) {
        if (!line.includes('Date')) {
            bucket = 'C';
        }
    }

    if (line.includes('timeZone: \'UTC\'') && !line.includes('createdAt')) {
        // Some schedule formats were explicitly using UTC formatting. We should probably migrate them to A.
        bucket = 'A';
    }

    if (line.match(/format\(new Date\(\),/)) {
        bucket = 'A';
    }

    output += `[BUCKET ${bucket}] ${line}\n`;
}

fs.writeFileSync('/Users/adeeljabbar/Downloads/Code Library/devcocrm/docs/DATE_MIGRATION_INVENTORY.md', output);
console.log('Inventory written to docs/DATE_MIGRATION_INVENTORY.md');
