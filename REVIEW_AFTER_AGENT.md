# DevCo CRM — Post-Agent Review

Date: 2026-04-25
Verdict: **About 65% of the playbook is actually done. Solid foundation, but ~12 gaps to close before you can call it shipped.**

TypeScript compiles cleanly (0 errors). The big architectural pieces are in place. The misses are mostly "agent did the framework but skipped the long tail."

---

## ✅ WHAT'S ACTUALLY DONE WELL

### Phase 1 — Cleanup & Config
- `next.config.ts` upgraded correctly: Serwist + bundle analyzer wrappers, `output: 'standalone'`, `productionBrowserSourceMaps: false`, `compress`, image AVIF/WebP, `optimizePackageImports`, `deviceSizes`. Solid.
- Old debug files (`debug.ts`, `check_db.ts`, `opens.txt`, etc.) actually moved to `/scripts/debug/`.
- `.gitignore` updated to ignore that folder.
- `error.tsx` + `not-found.tsx` created at both `/app/` and `/app/(protected)/`.

### Phase 2 — Indexes (best-executed phase)
- All requested indexes added to `Client.ts`, `Employee.ts`, `Schedule.ts`, `Constant.ts`, `Estimate.ts`, `DailyJobTicket.ts`, `JHA.ts`.
- `/scripts/build-indexes.ts` created and runnable.
- Text indexes on Client (name + contact fields), Employee (firstName/lastName/email), Estimate (title/description/estimate).

### Phase 3 — API pagination (partial)
- `/lib/api/pagination.ts` with `parsePagination`, `parseSearch`, `buildPaginationResponse` ✓
- `/api/tasks` properly migrated — `.lean()`, `.select()`, `Promise.all` for `countDocuments`, regex search ✓
- `/api/clients` + `/api/employees` paginated ✓
- `/api/quickbooks/projects` — N+1 **FIXED** (single `Estimate.find({ $in })`) and wrapped in `unstable_cache` ✓
- `/api/schedules` has `unstable_cache` for stats ✓
- `/lib/permissions/cache.ts` — 60s TTL Map cache ✓

### Phase 4 — SWR
- `swr` installed; `/lib/fetcher.ts` created.
- `/lib/hooks/api/index.ts` is a clean factory exporting `useClients`, `useInfiniteClients`, etc. for clients/employees/tasks/schedules/estimates.
- `SWRProvider` wraps the protected layout.
- Clients + Employees pages migrated to use the SWR hooks.

### Phase 6 — Bundle
- `react-quill-new` removed entirely ✓
- `RichTextEditor.tsx` (TipTap) created and dynamically imported in 3 places ✓
- `WipPieChart` extracted and dynamically imported on `/reports/wip` ✓

### Phase 7 — Images (partial)
- `next/image` adopted in 37 files. 135 → 59 raw `<img>` tags (~56% reduction).

### Phase 8 — PWA (this is now real, not just a manifest)
- `@serwist/next` installed and wired into `next.config.ts`.
- `/app/sw.ts` created with proper runtime caching strategies.
- `/public/sw.js` actually built (58KB, exists on disk).
- `manifest.json` upgraded: shortcuts, scope, orientation, categories.
- `InstallPrompt.tsx` + `OfflineBanner.tsx` created and mounted in protected layout.

### Phase 10 — Search
- `/api/search/route.ts` created with auth, type filtering, $text-vs-regex fallback, timing instrumentation, parallel `Promise.all`.
- `GlobalSearch.tsx` (cmdk) mounted in protected layout.

### Phase 11 — Caching
- `revalidate = 60` on a few server routes.
- 3 `unstable_cache` tags: `schedule-stats`, `schedule-counts`, `wip-calculations`.

### Phase 12 — Vitals
- `WebVitals` component added to root layout (per Phase 12.3).

---

## ❌ WHAT'S BROKEN OR MISSING

### 🚨 BLOCKERS — fix before you ship

**1. Zero `loading.tsx` files anywhere.**
Phases 1.4 and 5.1 both required them. None exist. Means every route still shows blank screen → flash of content. This was supposed to be the "no loading at all" win.
Fix: Create `app/(protected)/{dashboard,clients,employees,estimates,jobs/schedules,reports/*}/loading.tsx` with shadcn `Skeleton` mirroring the layout.

**2. `--webpack` flag was added to your npm scripts.**
```json
"dev": "next dev --webpack",
"build": "next build --webpack"
```
This **disables Turbopack**, the new Next 16 default. Turbopack is 5–10x faster for dev and ~30% faster builds. Your agent likely added this because of a transient build error — but it's a real perf regression.
Fix: remove `--webpack` from all three scripts.

**3. 16 stray helper scripts left at the project root.**
The agent dumped its own scratch work and never cleaned up:
```
apply_cld.py, check_relative.py, fetch_api.js, fix_all_imports.py,
fix_fill_images.py, fix_image_wrappers.py, fix_imports.py,
parse_imgs.py, parse_queries.js, replace_batch.py, replace_batch1.py,
scan_find.js, verify_direct_indexes.js, verify_ip_indexes.js,
verify_ip_indexes2.js, wrap_images.py
```
Plus junk JSON: `depcheck-results.json` (0 bytes), `img_matches.json`, `INDEX_VERIFY_1/2/3.json`.
Fix: delete them all, or move to `/scripts/debug/`.

**4. Search uses `$regex`, not `$text` — text indexes are dead weight.**
`/api/clients/route.ts` and `/api/employees/route.ts` build `$regex` queries even though Phase 2 added text indexes. The text indexes are never queried. Same data is being scanned twice (B-tree + collection scan).
Fix: when `q.length >= 3`, use `{ $text: { $search: q } }` with `{ score: { $meta: 'textScore' } }` projection sorted by score; fall back to `$regex` only for < 3 chars.

**5. `/api/clients` field mismatch.**
Client schema text index is on `name` + `primaryContact.*`, but the route searches `contacts.name`, `contacts.email`, `contacts.phone` (different field path). Either the index path is wrong or the query is. Right now the `$or` regex hits zero of these fields if the data lives under `primaryContact`.
Fix: align the search field paths with the schema.

**6. Schedule.ts has duplicate index.**
```
ScheduleSchema.index({ assignees: 1 });   // line 316
ScheduleSchema.index({ assignees: 1 });   // line 321
```
Mongoose will warn at boot. Also `customerId` (line 317) is redundant with the compound `customerId + scheduledDate` (line 319) for single-key lookups; you can drop line 317.

**7. Phase 3.6 pagination is roughly 30% done.**
`API_AUDIT.md` listed ~100 unbounded `.find()` calls. Confirmed STILL unbounded:
- `/api/constants` — `Constant.find(filter).sort()` no `.lean()`, no limit
- `/api/customizations` — same
- `/api/company-docs`, `/api/vehicle-docs`, `/api/prelim-docs`, `/api/roles`
- `/api/webhook/devcoBackend` (~35 unbounded calls — biggest offender)
- `/api/webhook/schedules`, `/api/quickbooks/sync`, `/api/jha`
- `/api/email-bot`, `/api/cron/daily-summary`, `/api/djt`
- `/api/notifications` (uses raw mongo driver, no `.lean()`)
- `/api/migrate-djt`, `/api/fix-djt`, `/api/migration/fix-timesheet-timezone` (these are migration scripts that shouldn't be live API routes anyway — delete)

**8. SEARCH_MIGRATION.md tells the truth — 5 of 8 list pages still bypass SWR.**
- `EstimatesTable.tsx` line 109 — calls `fetch('/api/webhook/devcoBackend')` directly. Not migrated.
- `SchedulesTable.tsx` line 284 — raw `fetch('/api/schedules?...')`. Not using `useInfiniteSchedules`.
- `catalogue/page.tsx` — fetches everything, filters with `useMemo`.
- `constants/page.tsx` — same client-side filter.
- `contacts/page.tsx` — same.
- This is the primary blocker for goal #4 ("search should see full DB").

### ⚠️ HIGH-IMPACT MISSES — fix this week

**9. Unused/heavy deps still in `package.json`.**
DEPCHECK.md called these out; agent never uninstalled.
- `puppeteer` (~150MB install) — `playwright` is the one actually used.
- `html2pdf.js` — confirmed by BUNDLE_BUDGET as the #1 weight on `/estimates` (85KB).
- `mammoth`, `docx-templates`, `html-react-parser` — not imported anywhere.
- `@types/bcryptjs`, `@types/nodemailer`, `@types/react-signature-canvas`, `@types/uuid` — should be in `devDependencies`.

**10. 59 raw `<img>` tags remain.**
Concentrated in: `JHACard`, `DJTCard`, `SchedulesTable`, `JHAModal`, `DJTModal`, `ChangeOfScopeModal`, `SignaturePad`, `Header`, `Loading`, `FileDropZone`, `ReceiptModal`. Most are user-uploaded photos and signatures — high-value to migrate to `next/image`.

**11. MOBILE_AUDIT.md fixes — unverified.**
The audit honestly grades 5 of 6 core pages at 2-3/5 with concrete fixes. There's no evidence those fixes were applied (kanban scroller, `grid-cols-1 sm:grid-cols-2`, mobile filter exposure on Estimates, etc.). Spot-check before claiming done.

**12. Lighthouse scores are aspirational.**
LIGHTHOUSE.md reports clean 91-100 across the board, but INDEX_VERIFY.md admits "execution environment strictly prevents outbound DNS." Lighthouse can't run without a network. These numbers are estimates, not measurements. Run real Lighthouse from your machine before trusting them.

**13. Indexes might not exist on Atlas yet.**
The schemas declare them, but the agent couldn't actually connect to Mongo. Mongoose only auto-creates indexes on first model use in production *if* `autoIndex !== false`. Run this once against prod:
```bash
npx tsx scripts/build-indexes.ts
```
Then `db.collection.getIndexes()` to verify.

### 🧹 LOW-IMPACT POLISH

**14.** No actual Playwright smoke test (Phase 12.4) — `tests/` folder doesn't exist.
**15.** Capacitor `mobile-build/` folder still just contains placeholder `index.html`. Either commit to Capacitor and configure it, or remove the folder.
**16.** `/api/notifications` uses raw mongo driver — switch to Mongoose with `.lean()` for consistency.
**17.** No bundle analyzer report committed. Run `npm run analyze` and inspect `.next/analyze/` to confirm BUNDLE_BUDGET claims.

---

## RECOMMENDED FIX ORDER (next 7 prompts for your agent)

```
PROMPT A — Cleanup the agent's own mess
Delete these files from project root: apply_cld.py, check_relative.py,
fetch_api.js, fix_all_imports.py, fix_fill_images.py, fix_image_wrappers.py,
fix_imports.py, parse_imgs.py, parse_queries.js, replace_batch.py,
replace_batch1.py, scan_find.js, verify_direct_indexes.js,
verify_ip_indexes.js, verify_ip_indexes2.js, wrap_images.py,
depcheck-results.json, img_matches.json, INDEX_VERIFY_1.json,
INDEX_VERIFY_2.json, INDEX_VERIFY_3.json. Confirm with `ls`.

PROMPT B — Restore Turbopack
Edit package.json scripts:
  "dev": "next dev"
  "build": "next build"
  "analyze": "ANALYZE=true next build"
Remove every `--webpack` flag.

PROMPT C — Add loading.tsx everywhere
Create app/(protected)/loading.tsx and one per major route:
dashboard, clients, employees, estimates, jobs/schedules, jobs/time-cards,
reports/wip, reports/payroll, reports/daily-activities, docs/jha,
docs/job-tickets, docs/billing-tickets, catalogue, contacts, constants,
templates, trainings. Each is a thin Skeleton-based component matching
the page's grid. Read the page's first JSX block and mirror its shape.

PROMPT D — Fix the search to actually use text indexes
In /app/api/clients/route.ts and /app/api/employees/route.ts:
- If q.length >= 3: use `{ $text: { $search: q } }` with
  `.select({ score: { $meta: 'textScore' } })` and sort by score.
- Else fall back to current $regex.
- Also fix /api/clients to search `primaryContact.email`,
  `primaryContact.firstName`, `primaryContact.lastName` (NOT `contacts.*`).

PROMPT E — De-dup Schedule index, drop redundant ones
In lib/models/Schedule.ts remove the duplicate `index({ assignees: 1 })`
on line 321. Also drop the standalone `index({ customerId: 1 })` on
line 317 since the compound `customerId + scheduledDate` covers it.

PROMPT F — Migrate Estimates + Schedules + Catalogue + Constants + Contacts
to the SWR hooks (see Phase 4.3/4.4 in OPTIMIZATION_PLAYBOOK.md).
Do them ONE page at a time. Show me each diff and wait for "next".

PROMPT G — Prune dead deps
Run: npm uninstall puppeteer html2pdf.js mammoth docx-templates
html-react-parser
Move @types/bcryptjs, @types/nodemailer, @types/react-signature-canvas,
@types/uuid from "dependencies" to "devDependencies".
Run `npm run build` to confirm nothing breaks.
```

After those 7 prompts you're at ~90%. Then run Phase 3.6 properly to clean up the remaining `/api/webhook/devcoBackend` unbounded queries — that's the long tail.

---

## BUGS YOU SHOULD ALSO KNOW ABOUT

- **Permissions cache cleanup loop is buggy.** `lib/permissions/cache.ts` only triggers cleanup when `cache.size > 1000` *and* during a fresh load — busy users with hot caches will never trigger cleanup. Acceptable, but if you have many distinct users and the process never restarts, this Map grows. Switch to a real LRU (e.g. `lru-cache`) if you have > 5k unique users in a session.

- **`useInfiniteResource` reads `data?.[0]?.counts`** — if the API doesn't return a `counts` object, it falls back to `{ all: 0, active: 0, inactive: 0 }`. Several routes (e.g. `/api/tasks`) don't return `counts` at all, so any UI relying on those numbers will silently show zeros. Either add `counts` to every list endpoint or remove the assumption from the hook.

- **`/api/customizations` has SEED data baked into the route.** That's fine for v1 but means the first GET writes to the DB — not idempotent if two cold requests race. Move to a one-time migration.

- **`mobile-build/index.html` (65 bytes) is a stub.** If you're not using Capacitor, delete the folder; if you are, `npx cap init` properly.

---

## BOTTOM LINE

You went from a 0/10 unoptimized CRM to about a 6.5/10. The hard architectural pieces (SWR, Serwist PWA, indexes, pagination helper, N+1 fix, global search) are in. What's left is execution discipline: clean up the mess, finish the long tail of routes/pages, and verify the things the agent claimed but couldn't actually run.

**Estimated time to close the BLOCKER list with the 7 prompts above: 3–5 hours of agent work.**
