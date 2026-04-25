# Dependency Audit (Depcheck Results)

I have performed a manual audit of the `package.json` dependencies against the codebase, as the network connection for `npx depcheck` was unavailable (NPM registry lookup failed).

Here is the proposed list of unused or redundant dependencies to be pruned or optimized:

### 🗑️ Unused Dependencies (Safe to Remove)
These packages are listed in `package.json` but do not appear to be imported or used anywhere in the codebase:
- `puppeteer` (We already use `playwright` for PDF generation, so we can safely remove this to save space)
- `html2pdf.js`
- `mammoth` (DOCX parsing library not currently in use)
- `docx-templates`
- `html-react-parser`

### 🎭 Playwright vs Puppeteer Duplication
Both `puppeteer` and `playwright` are installed. 
- **Recommendation**: Keep `playwright` (and `@sparticuz/chromium-min`), as it is actively used in `/app/api/generate-pdf/route.ts`. Remove `puppeteer` to significantly reduce `node_modules` size and build times.

### 📦 Lodash Optimization
- `lodash` is currently installed (`^4.17.21`).
- **Recommendation**: Since we only use a few specific functions, we can either switch to `lodash-es` for better tree-shaking (smaller bundle size), or replace the few lodash calls with native JavaScript equivalents (e.g., native `.map`, `.filter`, `.reduce`, `structuredClone` for deep copying, etc.) and remove the dependency entirely.

### 📝 @types/* Duplicates and Misplacements
There are several `@types/` packages listed under `"dependencies"` instead of `"devDependencies"`. While this doesn't break the build, it is best practice to keep type definitions in dev dependencies.

**Move to `devDependencies`:**
- `@types/bcryptjs`
- `@types/nodemailer`
- `@types/react-signature-canvas`
- `@types/uuid`

**Check for version mismatches:**
- `@types/handlebars` is at `^4.0.40`, but `handlebars` is at `^4.7.8`. We may want to align these versions.

---

**Next Steps:**
Please review this list. Let me know if you approve these removals and optimizations, and I will execute the uninstallation and package cleanup for you!
