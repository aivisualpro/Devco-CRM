const fs = require('fs');

const text = fs.readFileSync('./docs/DEVCOBACKEND_INVENTORY.md', 'utf8');
const jsonStr = text.replace(/```json\n/, '').replace(/\n```\n?/, '');
const data = JSON.parse(jsonStr);

let md = `# DevcoBackend API Migration Inventory\n\n`;
md += `| Status | Action | Type | Target Route | Notes |\n`;
md += `|---|---|---|---|---|\n`;

for (const item of data) {
    md += `| [ ] | \`${item.action}\` | ${item.type} | \`${item.newRoute}\` | ${item.notes} |\n`;
}

fs.writeFileSync('./docs/DEVCOBACKEND_INVENTORY.md', md);
console.log('Converted to MD Table');
