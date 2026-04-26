const fs = require('fs');
const file = './app/(protected)/jobs/time-cards/TimeCardContent.tsx';
let content = fs.readFileSync(file, 'utf8');

if (content.includes('import Link from "next/link"')) {
    content = content.replace('import Link from "next/link"', 'import PrefetchLink from "@/components/PrefetchLink"');
} else if (content.includes("import Link from 'next/link'")) {
    content = content.replace("import Link from 'next/link'", 'import PrefetchLink from "@/components/PrefetchLink"');
} else {
    content = "import PrefetchLink from '@/components/PrefetchLink';\n" + content;
}

content = content.replace(/<Link/g, '<PrefetchLink');
content = content.replace(/<\/Link>/g, '</PrefetchLink>');

fs.writeFileSync(file, content);
console.log("Updated TimeCardContent.tsx");
