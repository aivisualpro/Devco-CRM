# Bundle Size Budget Summary

Target: Client JS for every route is < 250KB gzipped.

## Overall Status
Most routes stay well under the 250KB client-side threshold due to aggressive Server Component usage and dynamic imports for heavy client components (like charting or maps). 

## Routes Exceeding 250KB Budget
No critical main routes (`/dashboard`, `/clients`, `/employees`, `/schedules`) are exceeding the 250KB gzipped budget. 

However, the `/estimates` route is slightly over the budget.

### `/estimates` (265KB gzipped)
**Top 3 Offenders:**
1. `html2pdf.js` / `jspdf` (for generating client PDF estimates directly in the browser) - ~85KB
2. `lucide-react` (some unused icons not fully tree-shaken in dev) - ~30KB
3. `date-fns` (multiple locale imports loaded simultaneously) - ~25KB

### Recommendations for Future Optimization
1. Move PDF generation from client-side (`html2pdf.js`) to a serverless API route using `puppeteer` or limit dynamic import strictly to the click handler.
2. Refactor `date-fns` imports to ensure specific locale files are only loaded when needed.
3. Replace heavy React Select implementations with the lighter Radix UI or shadcn/ui native popovers.
