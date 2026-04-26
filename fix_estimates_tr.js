const fs = require('fs');
const file = './app/(protected)/estimates/EstimatesTable.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('className="cursor-pointer hover:bg-gray-50 transition-colors block"', 'className="cursor-pointer hover:bg-gray-50 transition-colors"');
content = content.replace('className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer block"', 'className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer"');

fs.writeFileSync(file, content);
