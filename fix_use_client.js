const fs = require('fs');
const file = './app/(protected)/jobs/time-cards/TimeCardContent.tsx';
let content = fs.readFileSync(file, 'utf8');

if (content.startsWith("import PrefetchLink from '@/components/PrefetchLink';\n'use client';")) {
    content = content.replace("import PrefetchLink from '@/components/PrefetchLink';\n'use client';", "'use client';\nimport PrefetchLink from '@/components/PrefetchLink';");
    fs.writeFileSync(file, content);
    console.log("Fixed 'use client' ordering");
}
