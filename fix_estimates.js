const fs = require('fs');
const file = './app/(protected)/estimates/EstimatesTable.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<div\s+key=\{est\._id\}\s+className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-\[0\.98\] transition-all"\s+onClick=\{([^>]+?)>/, (match) => {
    return `<div
        key={est._id}
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer block"
        onMouseEnter={() => {
            const slug = est.estimate ? \`\${est.estimate}-V\${est.versionNumber || 1}\` : est._id;
            router.prefetch(\`/estimates/\${slug}\`);
        }}
        onClick={() => {
            const slug = est.estimate ? \`\${est.estimate}-V\${est.versionNumber || 1}\` : est._id;
            sessionStorage.setItem(\`preload_estimate_\${slug}\`, JSON.stringify(est));
            router.push(\`/estimates/\${slug}\`);
        }}
    >`;
});

content = content.replace(/<TableRow\s+key=\{est\._id\}\s+className="cursor-pointer hover:bg-gray-50 transition-colors"\s+onClick=\{([^>]+?)>/, (match) => {
    return `<TableRow
        key={est._id}
        className="cursor-pointer hover:bg-gray-50 transition-colors block"
        onMouseEnter={() => {
            const slug = est.estimate ? \`\${est.estimate}-V\${est.versionNumber || 1}\` : est._id;
            router.prefetch(\`/estimates/\${slug}\`);
        }}
        onClick={() => {
            const slug = est.estimate ? \`\${est.estimate}-V\${est.versionNumber || 1}\` : est._id;
            sessionStorage.setItem(\`preload_estimate_\${slug}\`, JSON.stringify(est));
            router.push(\`/estimates/\${slug}\`);
        }}
    >`;
});

fs.writeFileSync(file, content);
console.log("Updated EstimatesTable.tsx");
