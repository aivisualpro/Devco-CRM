# DevCo CRM — Optimization Playbook

Step-by-step "baby prompts" to feed your AI agent, one at a time, in order.
Each prompt is self-contained. Don't skip ahead — later phases assume earlier ones are done.

Goals recap:
1. Industry-standard performance
2. Mobile PWA + fully responsive
3. Instant routes, no loading flashes
4. DB-wide search + load-more pagination
5. End-to-end optimization

---

## PHASE 0 — GROUND RULES (run this first, once)

### Prompt 0.1 — Set the working contract
```
Read the file OPTIMIZATION_PLAYBOOK.md in the project root. That file is our
plan. We will execute one phase at a time. For every change you make:
- Do NOT rewrite files you weren't asked to touch.
- Do NOT add new dependencies without telling me which and why.
- After each change, show me the exact files changed and a 3-line summary.
- Never break existing routes or API shapes unless the prompt tells you to.
- After each phase, run `npm run build` and report any errors.

Confirm you've read the playbook and are ready for Phase 1.
```

---

## PHASE 1 — CLEANUP & FOUNDATION

### Prompt 1.1 — Kill the repo clutter
```
In /Users/adeeljabbar/Downloads/Code Library/devcocrm there are stray debug
and scratch files at the project root. Move the following into a new
/scripts/debug/ folder and add that folder to .gitignore:

check_db.ts, check_project.ts, check_qb.ts, debug.ts, debug_api.ts,
debug_djt.js, debug_jha_agg.js, debug_jha_agg.ts, fix_index.ts,
migrate_djt_creator.ts, test_agg.ts, closes.txt, opens.txt,
MYPROPOSAL_ADDITION.txt, PROPOSAL_DROPDOWN_FIXED.txt

Also add to .gitignore: .DS_Store, tsconfig.tsbuildinfo, .next/, mobile-build/

Show me the final .gitignore.
```

### Prompt 1.2 — Upgrade next.config.ts for production
```
Replace /next.config.ts with a production-ready config that adds:
- productionBrowserSourceMaps: false
- compress: true
- poweredByHeader: false
- output: 'standalone'
- experimental.optimizePackageImports for: 'lucide-react', '@radix-ui/react-icons',
  'date-fns', 'lodash', 'recharts'
- Keep existing images remotePatterns and serverActions config.
- Add a `images.formats` of ['image/avif','image/webp'] and deviceSizes of
  [360, 640, 768, 1024, 1280, 1536].

Show me the new file.
```

### Prompt 1.3 — Add bundle analyzer
```
Install @next/bundle-analyzer as a dev dependency and wire it into next.config.ts
behind the ANALYZE=true env flag. Add an npm script:
"analyze": "ANALYZE=true next build"

Run `npm run analyze` and report the top 10 heaviest chunks with sizes.
```

### Prompt 1.4 — Add loading.tsx, error.tsx, not-found.tsx at the root
```
Create three files under /app:
- app/loading.tsx  → a lightweight skeleton using shadcn/ui Skeleton
- app/error.tsx    → client component with "Try again" button calling reset()
- app/not-found.tsx → a clean 404 with a home link

Then create the same three files inside /app/(protected)/ with a skeleton
that matches the protected layout (sidebar + content area placeholders).

Use existing shadcn Skeleton from /components/ui/skeleton if present, or create it.
```

---

## PHASE 2 — DATABASE INDEXES (biggest speed win)

### Prompt 2.1 — Inventory current indexes
```
Read every file in /lib/models/*.ts and produce a table of (Model, Field, Index type,
Unique?). Do NOT change anything yet. Also list fields that are used in
.find(), .findOne(), .updateOne(), .aggregate() queries across /app/api/**
but do NOT have an index. Save the output as /docs/INDEX_AUDIT.md.
```

### Prompt 2.2 — Add missing indexes (Employee, Client, Schedule, Constant)
```
Based on /docs/INDEX_AUDIT.md, add these indexes:

Employee.ts:
  schema.index({ email: 1 }, { unique: true, sparse: true });
  schema.index({ status: 1 });
  schema.index({ groupNo: 1 });
  schema.index({ isScheduleActive: 1, status: 1 });
  schema.index({ firstName: 'text', lastName: 'text', email: 'text' });

Client.ts:
  schema.index({ name: 1 });
  schema.index({ 'primaryContact.email': 1 });
  schema.index({ createdAt: -1 });
  schema.index({ name: 'text', 'primaryContact.email': 'text',
                 'primaryContact.firstName': 'text',
                 'primaryContact.lastName': 'text' });

Schedule.ts:
  schema.index({ customerId: 1, scheduledDate: -1 });
  schema.index({ estimate: 1 });
  schema.index({ assignees: 1 });
  schema.index({ scheduledDate: -1 });
  schema.index({ status: 1 });

Constant.ts:
  schema.index({ type: 1 });
  schema.index({ type: 1, value: 1 });

Estimate.ts:
  schema.index({ estimate: 1, status: 1 });   // compound
  schema.index({ customerId: 1, createdAt: -1 });
  schema.index({ title: 'text', description: 'text', estimate: 'text' });

DailyJobTicket.ts:
  schema.index({ scheduleId: 1 });
  schema.index({ createdAt: -1 });
  schema.index({ createdBy: 1, createdAt: -1 });

JHA.ts:
  schema.index({ scheduleId: 1 });
  schema.index({ createdAt: -1 });

Do not touch the schema shape, just add the indexes at the bottom before
`mongoose.models.X || mongoose.model(...)`. Show me each diff.
```

### Prompt 2.3 — Force index build
```
Write a one-off script at /scripts/build-indexes.ts that connects to Mongo,
loops every model in /lib/models, calls `await Model.syncIndexes()`, logs
each index it created, and exits. Make it runnable with
`npx tsx scripts/build-indexes.ts`. Don't auto-run it — tell me to run it.
```

---

## PHASE 3 — BACKEND API OPTIMIZATION

### Prompt 3.1 — Create a shared pagination helper
```
Create /lib/api/pagination.ts exporting:
- parsePagination(request: NextRequest) → { page, limit, skip, sort }
  * page defaults 1, limit defaults 25, max 100
  * sort parsed from `sort=field:asc|desc`
- buildPaginationResponse(items, total, page, limit) →
  { items, page, limit, total, hasMore, nextPage }

Also export a parseSearch(request) → { q: string | null } helper that
reads ?q=... from the URL and returns it trimmed.

Add tests if a test runner is set up; otherwise just export.
```

### Prompt 3.2 — Paginate /api/tasks
```
Open /app/api/tasks/route.ts. In the GET handler:
- Use parsePagination + parseSearch from /lib/api/pagination.
- Apply .find(query).select('-largeField').lean().sort(sort).skip(skip).limit(limit)
  (use only fields the frontend needs — inspect the client usage first and tell me
  which fields you're selecting).
- Also compute `total = await DevcoTask.countDocuments(query)` in parallel with Promise.all.
- If q is present, add a text filter: { $text: { $search: q } } OR fallback regex
  on title/description.
- Return buildPaginationResponse(...).

Do NOT break existing callers — search /app usage of fetch('/api/tasks') and
update them to read `items` instead of the old root-level array. Show me every
callsite touched.
```

### Prompt 3.3 — Paginate /api/schedules
```
Same pattern as 3.2, but for /app/api/schedules/route.ts. Also:
- Replace any populate() with manual $lookup aggregation OR add .lean().
- Add .select() to fetch only fields the Schedules UI needs.
- Support filters: ?status=, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?assignee=<id>.

Update /app/(protected)/jobs/schedules/page.tsx to use the new response shape.
```

### Prompt 3.4 — Fix the N+1 in /api/quickbooks/projects
```
/app/api/quickbooks/projects/route.ts currently loops projects and calls
Estimate.find(...) per project (N+1). Rewrite to:
1. Fetch all projects once (.lean(), with .select()).
2. Collect all project numbers into an array.
3. Run a single Estimate.find({ estimate: { $in: projectNumbers } }).lean().
4. Build a Map<projectNumber, estimate> in memory.
5. Stitch in one pass.

Confirm the response shape is unchanged, and show me the before/after
query count and the diff.
```

### Prompt 3.5 — Audit every other API route for unbounded .find()
```
Scan /app/api/**/route.ts for any .find(...) without .limit() or .lean().
Produce /docs/API_AUDIT.md listing each route, the line, and whether it
needs pagination. Don't fix yet — just list.
```

### Prompt 3.6 — Paginate everything in API_AUDIT.md, one route per reply
```
Go through /docs/API_AUDIT.md one route at a time. For each:
- Add pagination using /lib/api/pagination.
- Add .lean() and .select().
- Keep response shape { items, page, limit, total, hasMore } for list endpoints.
- Update all client callers.
- After each route is done, show me the diff and wait for me to say "next".
```

### Prompt 3.7 — Cache the permissions load
```
/lib/permissions/middleware.ts calls the DB on every API request to load
permissions. Add a per-request LRU cache keyed by userId with a 60-second TTL.
Use a tiny in-memory Map with a timestamp; no new deps.

File: /lib/permissions/cache.ts — export getCachedPermissions(userId, loader).
Plug it into getUserFromRequest(). Do not change the public signature.
```

---

## PHASE 4 — FRONTEND DATA LAYER (SWR)

### Prompt 4.1 — Install and wire SWR
```
Install swr. Create /lib/fetcher.ts exporting:
- fetcher(url) → fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText);
  return r.json(); })

Wrap the root protected layout (/app/(protected)/layout.tsx) in an SWRConfig
provider with:
- revalidateOnFocus: false
- revalidateOnReconnect: true
- dedupingInterval: 10_000
- fetcher: the one above
- shouldRetryOnError: false

Do NOT remove any existing useEffect fetches yet — we'll migrate in the next step.
```

### Prompt 4.2 — Build typed SWR hooks for core resources
```
Create /lib/hooks/api/ folder with:
- useClients({ q, page, limit }) → SWR hook hitting /api/clients
- useEmployees({ q, page, limit })
- useTasks({ q, page, limit, status })
- useSchedules({ q, page, from, to, status })
- useEstimates({ q, page, limit })

Each returns { items, total, hasMore, isLoading, error, mutate } and uses
SWR's key array [url, params] so cache is automatic.

Also add useInfinite variants (useInfiniteClients, etc.) using SWR's
useSWRInfinite for "load more" UIs.
```

### Prompt 4.3 — Migrate Clients page to useInfiniteClients
```
/app/(protected)/clients/page.tsx currently uses useState + useEffect + fetch
and filters client-side. Refactor:
- Remove the fetchClients useEffect.
- Use useInfiniteClients({ q: debouncedSearch, limit: 25 }).
- The search input debounces 300ms and passes to the hook.
- Remove all client-side .includes() filtering. The API returns filtered items.
- "Load more" button calls setSize(size + 1).
- Keep the existing table/card layout.

Show me the diff and confirm no visual regressions.
```

### Prompt 4.4 — Migrate Employees / Tasks / Schedules / Estimates
```
Repeat the Prompt 4.3 migration for:
- /app/(protected)/employees/page.tsx
- /app/(protected)/jobs/schedules/page.tsx
- /app/(protected)/estimates/page.tsx
- Any tasks list pages

Do ONE page at a time. After each one, show me the diff and wait for "next".
```

### Prompt 4.5 — Global search command palette
```
Create /components/search/GlobalSearch.tsx using cmdk (already installed).
Trigger: Ctrl/Cmd+K from anywhere in the protected layout.

It hits a new /app/api/search/route.ts that runs in parallel:
- Clients ($text or regex on name/email)
- Employees ($text on firstName/lastName/email)
- Estimates ($text on title/description/estimate)
- Schedules (by jobName/notes)

Each returns top 5 matches. Display grouped results. Clicking jumps to the
detail route. Debounce input 250ms. Use AbortController to cancel in-flight.

Mount <GlobalSearch /> in /app/(protected)/layout.tsx.
```

---

## PHASE 5 — ROUTE PERFORMANCE (zero loading)

### Prompt 5.1 — Add route-level loading skeletons
```
For each of these routes, add a loading.tsx next to page.tsx that mirrors
the page layout with shadcn Skeleton components:

- /app/(protected)/dashboard/loading.tsx
- /app/(protected)/clients/loading.tsx
- /app/(protected)/employees/loading.tsx
- /app/(protected)/estimates/loading.tsx
- /app/(protected)/jobs/schedules/loading.tsx
- /app/(protected)/jobs/time-cards/loading.tsx
- /app/(protected)/reports/*/loading.tsx (payroll, wip, etc.)
- /app/(protected)/docs/*/loading.tsx (one per doc type)

Do not make them fancy — just rows/cards of Skeletons matching the real layout.
```

### Prompt 5.2 — Prefetch on link hover
```
Create /components/PrefetchLink.tsx that wraps next/link with
prefetch={true} and also calls router.prefetch(href) on onMouseEnter/onFocus
for instant navigation on desktop and tap on mobile.

Replace <Link> imports in /components/layout/Sidebar.tsx and
/components/layout/MobileBottomNav.tsx with PrefetchLink.
```

### Prompt 5.3 — Convert list pages to RSC + streaming (optional, advanced)
```
This is optional but big. For /app/(protected)/clients/page.tsx:
1. Make the page itself a server component (no "use client").
2. Fetch the first page of clients server-side using the mongoose model
   directly (not via /api/clients).
3. Pass initialData to a new client child component <ClientsTable />.
4. <ClientsTable /> calls useInfiniteClients with { fallbackData: initialData }.
5. Wrap <ClientsTable /> in <Suspense fallback={<ClientsTableSkeleton />}>.

Result: first paint is instant with data, subsequent pagination is SWR.
Same pattern for Employees, Estimates, Schedules.
```

---

## PHASE 6 — BUNDLE SURGERY

### Prompt 6.1 — Kill react-quill-new
```
react-quill-new is deprecated and ~250KB. We already have the full TipTap
suite. Find every import of react-quill-new and replace it with a TipTap
editor component at /components/editor/RichTextEditor.tsx.

The new component should:
- Take value: string, onChange: (html: string) => void, placeholder?: string
- Include StarterKit, Link, Image, Underline, TextAlign, TextStyle, Color,
  Highlight, Table extensions (all already installed).
- Show a toolbar with bold/italic/underline/link/image/list/heading/align.

Then run `npm uninstall react-quill-new`.
```

### Prompt 6.2 — Lazy-load heavy libs on report pages
```
On /app/(protected)/reports/payroll/page.tsx and wip/page.tsx:

- Wrap @react-pdf/renderer usage in `const PayrollPDF = dynamic(() =>
  import('./PayrollPDF'), { ssr: false, loading: () => <Skeleton /> });`
- Wrap recharts imports in a dynamic component.
- Wrap xlsx export in a handler that does `const XLSX = await import('xlsx')`
  only when the user clicks Export.

Show bundle size before/after in the analyzer.
```

### Prompt 6.3 — Dynamic-import the rich text editor and PDF preview
```
/components/editor/RichTextEditor.tsx (from 6.1) should be imported
dynamically wherever it's used:
`const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> });`

Same for any PDF preview / html2pdf usage. Never ship @react-pdf, html2pdf,
or tiptap in the base route chunk.
```

### Prompt 6.4 — Lazy-load Stream Chat
```
If stream-chat / stream-chat-react is used anywhere, make sure the Chat
provider and channel components are dynamically imported and only mounted
on the chat route. It should not appear in the dashboard or clients chunk.
```

### Prompt 6.5 — Audit and prune deps
```
Run `npx depcheck`. Produce a list of unused dependencies in /docs/DEPCHECK.md.
Do not uninstall anything automatically — propose a list and wait for me to
approve. Also flag:
- puppeteer vs playwright duplication (pick one)
- multiple @types/* duplicates
- lodash (we can use lodash-es for better tree-shaking, or native)
```

---

## PHASE 7 — IMAGES

### Prompt 7.1 — Replace all <img> with next/image
```
There are ~135 raw <img> tags in the app. Go through /app/** and /components/**
and replace every <img src={...} /> with <Image from "next/image" ... />.

Rules:
- If the image URL is Cloudinary, use the <Image> directly (already whitelisted).
- For unknown size, set fill + parent with `relative` + explicit className sizing,
  or set width + height if known.
- Always set `sizes` for fill images (e.g., "(max-width: 768px) 100vw, 33vw").
- Keep alt text meaningful.
- Use priority only for above-the-fold hero images.

Do it in batches of 20 files max per reply. After each batch, show me the
files changed and wait for "next".
```

### Prompt 7.2 — Cloudinary transform helper
```
Create /lib/cloudinary.ts exporting:
cld(url, { w?, h?, q?='auto', f?='auto', crop?='fill' }) → transformed URL.

Then update /components/ui/Avatar, list card thumbnails, and any training
image to use cld(url, { w: 128, q: 'auto' }) for thumbnails and
{ w: 1200 } for hero shots.
```

---

## PHASE 8 — PWA (make it installable + offline)

### Prompt 8.1 — Install Serwist (modern next-pwa)
```
Install @serwist/next and serwist. Follow the App Router setup:
- Create /app/sw.ts as the service worker entry.
- Configure /next.config.ts with withSerwist wrapper (dev-disabled).
- Cache strategies:
  * / (app shell) → StaleWhileRevalidate
  * /api/* → NetworkFirst with 3s timeout
  * /_next/image, /_next/static → CacheFirst, 30-day
  * Cloudinary images → CacheFirst, 30-day, maxEntries 200
- precacheManifest from Next.js build.

Confirm `npm run build` succeeds and the SW is emitted at /public/sw.js.
```

### Prompt 8.2 — Polish the manifest
```
Update /public/manifest.json to include:
- short_name, description, categories: ["business","productivity"]
- orientation: "portrait"
- scope: "/"
- background_color matching theme
- shortcuts array with 3 entries: Dashboard, Schedules, Clients
- screenshots (mobile + desktop) if you have them, referenced from /public/screenshots/
```

### Prompt 8.3 — Add install prompt + offline banner
```
Create /components/pwa/InstallPrompt.tsx:
- Listens for 'beforeinstallprompt' event.
- Shows a dismissible bottom card on mobile offering "Install App".
- Stores dismissal in localStorage for 14 days.

Create /components/pwa/OfflineBanner.tsx:
- Uses navigator.onLine + online/offline events.
- Shows a slim yellow bar at the top when offline.

Mount both in /app/(protected)/layout.tsx.
```

### Prompt 8.4 — PWA QA checklist
```
Write /docs/PWA_CHECKLIST.md with steps to test:
1. Chrome DevTools > Application > Manifest (all green).
2. Lighthouse PWA audit scoring 100.
3. Install from mobile Chrome; open offline; see cached shell.
4. Add to Home Screen on iOS Safari; launch; verify standalone.
5. Kill network mid-request and confirm OfflineBanner appears.
```

---

## PHASE 9 — MOBILE RESPONSIVENESS

### Prompt 9.1 — Mobile-first audit
```
Sample these 6 pages and grade mobile responsiveness (1–5) with notes on
what breaks on a 360px viewport:
- /dashboard, /clients, /employees, /jobs/schedules, /estimates, /reports/wip

Use the existing Tailwind breakpoints. Save /docs/MOBILE_AUDIT.md with a
per-page list of "fixes needed". Don't change code yet.
```

### Prompt 9.2 — Fix per page (one at a time)
```
Work through /docs/MOBILE_AUDIT.md one page at a time:
- Stack horizontal rows into vertical on < sm.
- Replace fixed widths with w-full + max-w.
- Use card layout on < md, table on >= md (conditional render).
- Ensure tap targets are ≥ 44px.
- Keep existing lg: desktop layout unchanged.

After each page, show the diff and wait for "next".
```

### Prompt 9.3 — Bottom nav polish
```
/components/layout/MobileBottomNav.tsx (or wherever the 5-tab nav lives):
- Use PrefetchLink (from 5.2).
- Active tab: bold icon + label + 3px top indicator.
- Add haptic feedback on tap using navigator.vibrate(10).
- Safe-area-inset-bottom padding is already present; keep it.
- Hide on keyboard open (window.visualViewport height listener).
```

### Prompt 9.4 — Touch / swipe gestures
```
Install embla-carousel-react (already a dep). On the clients and
estimates detail pages, wrap tabs in an Embla carousel so users can swipe
between tabs on mobile. Desktop unchanged.
```

---

## PHASE 10 — SEARCH THAT SEES THE WHOLE DB

### Prompt 10.1 — Text indexes (already added in 2.2) — verify
```
Run `node -e` or a tsx script that connects to Mongo and calls
db.collection.getIndexes() for clients, employees, estimates, tasks.
Confirm the text indexes from Phase 2 exist. Save the output to
/docs/INDEX_VERIFY.md.
```

### Prompt 10.2 — /api/search — unified search endpoint
```
Create /app/api/search/route.ts. GET handler:
- Auth required.
- ?q=<string>  (required, 2+ chars)
- ?types=clients,employees,estimates,schedules  (optional filter)
- ?limit=10 per type (max 20)

Run all type searches in Promise.all, each using $text with textScore
projection + sort by score, falling back to regex for short queries (< 3 chars).

Response:
{
  q, types,
  results: { clients: [...], employees: [...], estimates: [...] },
  timing: { totalMs, perType: {...} }
}

Instrument with console.time for now.
```

### Prompt 10.3 — Wire /api/search into the cmdk palette from 4.5
```
Update /components/search/GlobalSearch.tsx to call /api/search?q=...
instead of separate endpoints. Keep debouncing and AbortController.
Render grouped results with result count badges.
```

### Prompt 10.4 — Per-page search uses server
```
Anywhere a list page has a search input (clients, employees, estimates,
schedules, tasks, trainings, etc.), confirm the search input now drives the
SWR hook's `q` param (from Phase 4) and hits the backend, NOT client-side
filtering. Produce a report /docs/SEARCH_MIGRATION.md listing each page
and confirming.
```

---

## PHASE 11 — CACHING & REVALIDATION

### Prompt 11.1 — Route segment caching
```
For read-heavy server components (dashboard widgets, report summaries),
export `export const revalidate = 60;` so they ISR-cache for 60s.

Explicitly do NOT cache routes under /app/api/auth/**, /api/upload*, or
anything mutation-related.
```

### Prompt 11.2 — unstable_cache for expensive aggregations
```
Wrap the dashboard's most expensive aggregations (monthly payroll totals,
schedule counts, WIP calculations) in unstable_cache with tags and 5-minute
revalidate. On mutation, call revalidateTag() in the POST/PATCH handler.

List every cache tag introduced in /docs/CACHE_TAGS.md.
```

### Prompt 11.3 — HTTP cache headers on GET APIs
```
For public GET endpoints (constants, countries list, etc. — NOT user data),
return `Cache-Control: s-maxage=300, stale-while-revalidate=600`. List each
route you changed.
```

---

## PHASE 12 — FINAL QA & VERIFY

### Prompt 12.1 — Lighthouse benchmark
```
Open /dashboard, /clients, /employees, /estimates in Lighthouse (mobile).
Save a summary at /docs/LIGHTHOUSE.md with Performance, Accessibility, Best
Practices, SEO, PWA scores for each. Target: Perf > 90, PWA 100.
```

### Prompt 12.2 — Bundle size budget
```
Open the bundle analyzer report. For every route, confirm the client JS
for the route is < 250KB gzipped. Any route above that, list in
/docs/BUNDLE_BUDGET.md with the top 3 offenders per route.
```

### Prompt 12.3 — Core Web Vitals in prod
```
Add Vercel Speed Insights (or web-vitals library) and log LCP, FID, CLS,
INP for every route to a simple /api/vitals endpoint that writes to a
lightweight Mongo collection. Build a /reports/vitals page showing p75
values per route over the last 7 days.
```

### Prompt 12.4 — Smoke test
```
Write a Playwright smoke test (already installed) at /tests/smoke.spec.ts
that:
- Logs in
- Visits dashboard, clients, employees, estimates, schedules
- Confirms no console errors
- Confirms each route First Contentful Paint < 1.5s
- Confirms search returns results within 500ms

Run it with `npx playwright test tests/smoke.spec.ts`.
```

---

## SUGGESTED PACING

- **Week 1:** Phases 0–2 (cleanup + indexes) — biggest speed win, lowest risk.
- **Week 2:** Phase 3 (API pagination) + Phase 4 (SWR) — pick ONE page at a time.
- **Week 3:** Phase 5 (routing) + Phase 6 (bundle surgery) — use analyzer to prove wins.
- **Week 4:** Phases 7–10 (images, PWA, mobile, search) — the polish.
- **Week 5:** Phases 11–12 (caching + QA).

**Hard rule:** never run two phases in parallel. Each one mutates areas the next depends on.

---

## COMMON PITFALLS TO WARN YOUR AGENT ABOUT

1. Don't populate() without selecting fields — it destroys .lean() perf.
2. Don't forget to wrap SWR's fallbackData — otherwise the first paint still flashes.
3. Text indexes + $text require exact stemming; add a `score` projection or it'll sort randomly.
4. `"use client"` at the top of a page prevents any server-side data fetching
   below it — move data fetching up into the server component parent.
5. next/image needs `fill` OR explicit `width`/`height` — mixing them breaks layout.
6. Service workers cached in dev will drive you mad; always test PWA in prod builds.
7. MongoDB text indexes are one-per-collection — plan field coverage carefully.
8. Capacitor builds (android/ios) won't see service worker — use Capacitor's
   native caching plugin instead for the mobile-build/ output.

---

End of playbook. Start with Prompt 0.1.
