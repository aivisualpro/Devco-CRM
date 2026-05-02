const fs = require('fs');

const files = [
    { path: 'app/(protected)/settings/general/document-ids/page.tsx', tab: 'docIds' },
    { path: 'app/(protected)/settings/general/sms-variables/page.tsx', tab: 'customizations' },
    { path: 'app/(protected)/settings/general/workflow/page.tsx', tab: 'workflow' },
    { path: 'app/(protected)/settings/general/email-bots/page.tsx', tab: 'emailBot' },
];

for (const file of files) {
    let content = fs.readFileSync(file.path, 'utf8');
    
    // Hardcode the active tab for this file so it always renders its specific content
    content = content.replace(/const \[activeTab, setActiveTab\] = useState\([^)]+\);/, `const activeTab = '${file.tab}';`);
    
    // Remove Header
    content = content.replace(/<Header hideLogo=\{false\} \/>/, '');
    
    // Remove Tabs UI completely
    content = content.replace(/\{\/\* Tabs \*\/\}\s*<div className="flex gap-1 border-b border-slate-200">[\s\S]*?<\/div>\s*(?=\{\/\* (───|Tab:))/g, '');

    // Rename the component to something unique to avoid conflicts or just keep as default
    const nameMap = {
        'docIds': 'DocumentIdsSettings',
        'customizations': 'SmsVariablesSettings',
        'workflow': 'WorkflowSettingsPage',
        'emailBot': 'EmailBotsSettings'
    };
    content = content.replace(/export default function GeneralSettings\(\) \{/, `export default function ${nameMap[file.tab]}() {`);

    fs.writeFileSync(file.path, content);
}
console.log('Done fixing wrappers');
