const fs = require('fs');

const routeContent = fs.readFileSync('./app/api/webhook/devcoBackend/route.ts', 'utf8');
const lines = routeContent.split('\n');

const inventory = [];
let currentAction = null;

const actionRegex = /^\s*case ['"]([^'"]+)['"]:/;

for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(actionRegex);
    if (match) {
        currentAction = match[1];
        
        let type = 'UNKNOWN';
        if (currentAction.startsWith('get') || currentAction.startsWith('preview')) type = 'READ';
        else if (currentAction.startsWith('create') || currentAction.startsWith('add') || currentAction.startsWith('import') || currentAction.startsWith('clone') || currentAction.startsWith('copy') || currentAction.startsWith('upload') || currentAction.startsWith('generate')) type = 'WRITE';
        else if (currentAction.startsWith('update') || currentAction.startsWith('save') || currentAction.startsWith('sync')) type = 'WRITE';
        else if (currentAction.startsWith('delete')) type = 'DELETE';
        
        let newRoute = '';
        if (currentAction.includes('Estimate')) newRoute = type === 'READ' ? 'GET /api/estimates' : 'POST/PATCH/DELETE /api/estimates';
        else if (currentAction.includes('Client')) newRoute = type === 'READ' ? 'GET /api/clients' : 'POST/PATCH/DELETE /api/clients';
        else if (currentAction.includes('Employee')) newRoute = type === 'READ' ? 'GET /api/employees' : 'POST/PATCH/DELETE /api/employees';
        else if (currentAction.includes('Catalogue') || currentAction.includes('Constant') || currentAction.includes('LineItem') || currentAction.includes('Template')) newRoute = 'API /api/catalogue';
        else if (currentAction.includes('Schedule')) newRoute = 'API /api/schedules';
        else newRoute = 'API /api/misc';
        
        let notes = '';
        if (currentAction === 'getEmployees') notes = 'MUST redact password - see BLOCKER 1';

        inventory.push({
            action: currentAction,
            type,
            newRoute,
            notes
        });
    }
}

fs.writeFileSync('./docs/DEVCOBACKEND_INVENTORY.md', '```json\n' + JSON.stringify(inventory, null, 2) + '\n```\n');
console.log('Saved to /docs/DEVCOBACKEND_INVENTORY.md');
