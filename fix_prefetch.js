const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = [...walk(path.join(__dirname, 'app')), ...walk(path.join(__dirname, 'components'))];
let updatedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern 1: onClick={() => router.push(`/path/${var}`)}
    // We want to add onMouseEnter={() => router.prefetch(`/path/${var}`)} before onClick
    const regex1 = /onClick=\{([^}]*?)\brouter\.push\(([^)]+)\)[^}]*?\}/g;
    
    // We will do a replacement but we need to be careful not to duplicate onMouseEnter if it already exists
    content = content.replace(regex1, (match, before, url) => {
        if (match.includes('onMouseEnter') || original.includes('onMouseEnter')) return match; // rudimentary check, skip if already has onMouseEnter
        
        // Example: onClick={() => router.push(`/estimates/${slug}`)}
        // or onClick={(e) => { e.stopPropagation(); router.push(url); }}
        
        // We can just add onMouseEnter={() => router.prefetch(url)} before the onClick
        return `onMouseEnter={() => router.prefetch(${url})} ${match}`;
    });
    
    // Check for onRowClick in Tables
    // Pattern: onRowClick={(row) => router.push(`/path/${row.id}`)}
    // Let's add onRowMouseEnter={(row) => router.prefetch(`/path/${row.id}`)}
    const regex2 = /onRowClick=\{\((.*?)\)\s*=>\s*router\.push\((.*?)\)\}/g;
    content = content.replace(regex2, (match, args, url) => {
        if (content.includes('onRowMouseEnter')) return match;
        return `onRowMouseEnter={(${args}) => router.prefetch(${url})} ${match}`;
    });

    if (content !== original) {
        fs.writeFileSync(file, content);
        updatedFiles++;
        console.log(`Updated ${file.replace(__dirname, '')}`);
    }
});

console.log(`Finished. Updated ${updatedFiles} files.`);
