# POST-IMPLEMENTATION AUDIT — DevCo CRM (April 2026)

> Verification pass after all MASTER_AUDIT_2026 prompts were marked complete. Four parallel audits checked P0/P1/P2/P3 work and looked for new regressions.

---

## OVERALL VERDICT

**~70% of the master audit landed cleanly. ~30% is half-done or skipped.** The good news: the security holes are closed, the foundation primitives exist, and AppSheet is gone. The bad news: the webhook monolith is still alive and powering 90 frontend call sites, cache invalidation is decorative not real, and a few sneaky regressions slipped in.

| Phase | Grade | Status |
|---|---|---|
| P0 — Critical blockers | **B+** | 5/6 PASS, 1 PARTIAL (permissions per-user invalidation) |
| P0.6 — AppSheet removal | **A** | Clean removal, well done |
| P1 — Component consolidation | **B** | Primitives shipped, migration ~50% complete |
| P2 — Data layer unification | **D+** | Infrastructure built but webhook still alive, 47 `revalidateTag` hacks remain, 90 call sites unmigrated |
| P3 — Cleanup | **B-** | Cache headers done, dashboard partially split, `playwright-core` still in deps |

---

## ✅ WHAT'S WORKING NOW (don't break these)

- **Password redaction** — `.select('-password -refreshToken -__v')` everywhere it matters. ✓
- **Schedule N+1** — every loop replaced with a batched `$in` query + Map lookup. Major dashboard speedup unlocked. ✓
- **Client `primaryContact` virtual** — schema and indexes aligned. ✓
- **`/api/vitals`** — 204 immediately, `sendBeacon` from client. No more 5-second blocks. ✓
- **AppSheet** — completely removed. Zero references remain except the `DEVCOAPPSHEET_MONGODB_URI` env var (intentionally preserved as the DB connection). ✓
- **Permissions cache** — `unstable_cache` + Cache-Control header. ✓ (per-user invalidation still missing — see below)
- **AppContext** — `useCurrentUser`, `usePermissions`, `useAppSettings`, `useCan` all exported and consumed. localStorage references gone. ✓
- **Settings page** — single consolidated `/api/app-settings/all` fetch instead of 5 cascading calls. ✓
- **GenericLineItemsTable** — all 8 line-item tables migrated. ~2,750 LOC removed. ✓
- **Status badges, UserChip, PageHeader, EmptyState** — primitives exist with `/components/ui/README.md`. ✓
- **HTTP cache headers** — set on `/api/constants`, `/api/roles`, `/api/auth/me`, `/api/auth/me/permissions`. ✓
- **Dashboard heavy modals** — using `next/dynamic` with `ssr: false`. ✓
- **Chat polling** — `refreshInterval: 10000` removed. ✓

---

## 🔴 OPEN ISSUES (in severity order)

### ISSUE 1 — The webhook monolith is still alive [CRITICAL]
- `/app/api/webhook/devcoBackend/route.ts` is **2,777 lines** (P2.1 was supposed to delete it).
- `/docs/DEVCOBACKEND_INVENTORY.md` exists but **all 68 actions still marked `[ ]` unchecked**.
- **90 frontend call sites across 51 files** still hit `'/api/webhook/devcoBackend'`.
- This single fact is why the speed and consistency problems aren't resolved yet — every list page on the frontend that wasn't explicitly migrated still goes through this POST-bypasses-cache monolith.

### ISSUE 2 — `revalidateTag(tag, undefined as any)` hack still everywhere [CRITICAL]
- **47 instances** of the broken second-arg pattern remain across:
  - `/app/api/webhook/devcoBackend/route.ts` — 12 hits
  - `/app/api/schedules/route.ts` — 12 hits
  - `/app/api/estimates/[id]/route.ts` — 7 hits
  - 16 hits across other routes
- The second arg is invalid; the function works at runtime but the cast suppresses real type checking. Removing it may surface real type errors that should be addressed (likely an outdated `next` types regen needed).

### ISSUE 3 — `playwright-core` is in production `dependencies` [HIGH]
- `package.json` line 87. Adds ~100 MB to every Vercel build and serverless deployment.
- `playwright` is correctly in `devDependencies`. Just `playwright-core` is misplaced.

### ISSUE 4 — Schedule model hot-reload runs in production [HIGH]
- `/lib/models/Schedule.ts` lines 340–341 do `delete mongoose.models.Schedule` **unconditionally** (no `process.env.NODE_ENV === 'development'` guard).
- Result: every cold-start serverless invocation re-registers and re-syncs indexes. Expensive.
- `Client.ts` line 101 does this correctly (gated). Schedule should match.

### ISSUE 5 — Phantom Schedule indexes [HIGH]
- `/lib/models/Schedule.ts` lines 335, 337–338 declare indexes on **fields that don't exist** in the schema:
  - `{ customerId: 1, scheduledDate: -1 }` — neither `customerId` nor `scheduledDate` exists (the actual fields are `customerName` and `fromDate`).
  - The other two reference `scheduledDate` and `status` which also don't exist on Schedule.
- Mongoose silently fails to create these. The index slots are wasted, and the queries that should be using these indexes end up doing collection scans.

### ISSUE 6 — Permissions cache: per-user invalidation never wired [HIGH]
- `/app/api/roles/route.ts` lines 125, 242, 318 only call `revalidateTag('permissions-all', undefined as any)`.
- When you change ONE employee's role, this invalidates the cache for everyone. Inefficient.
- Worse: `/app/api/employees/**` PATCH/PUT handlers don't invalidate at all. Editing an employee's role from the employee detail page doesn't refresh their permissions.
- Also the second-arg hack (Issue 2) appears here.

### ISSUE 7 — Date formatter migration only ~65% done [MEDIUM]
- `/lib/format/date.ts` exists with all 6 functions, correctly wall-clock based (no `Intl` or `toLocaleDateString` on user data). ✓
- BUT **174 inline `toLocaleDateString` / `format(parseISO(...))` calls remain across 64 files**. Target was near-zero.
- Hot spots: payroll (13), schedules (5), receipts (5), dashboard (7), estimates (3).
- Risk: a viewer in Pakistan vs LA may still see different timestamps on those 64 files until they're migrated.

### ISSUE 8 — DataTable migration ~25% done [MEDIUM]
- `<DataTable>` exists and looks complete.
- Only ClientsTable + EmployeesTable use it. `/jobs/schedules`, `/estimates`, `/tasks`, `/catalogue`, `/constants`, `/contacts` all still ship their own table implementations.
- This is the source of much of the remaining duplicated UI logic (filtering, sorting, mobile cards).

### ISSUE 9 — EntityFormModal: only Catalogue dialogs migrated [MEDIUM]
- All 8 Catalogue Add Dialogs use `<EntityFormModal>`. ✓
- All 8 Estimate Add Dialogs **still standalone** — ~3,734 lines of duplication remain.

### ISSUE 10 — Dashboard `_components/` directory not created [LOW]
- Dashboard went from 4,941 → 4,539 lines. Modals are dynamic-imported. ✓
- But the planned `_components/` split (WeekPicker, ScheduleStrip, TaskList, StatsCards, ChatWidget, SchedulesGrid as separate files) didn't happen.
- The page is still a single 4.5K-line client component.

### ISSUE 11 — Debug `console.log` left in `/api/schedules` hot path [LOW]
- `/app/api/schedules/route.ts` line 135: `console.log('FETCHED SCHEDULE:', ...)`.
- Fires on every schedule fetch in production. Logs add up on Vercel.

---

## ACTION PROMPTS (paste into your agent)

### PROMPT FU.1 — Finish killing the webhook monolith (the big one)

```
Open /docs/DEVCOBACKEND_INVENTORY.md. All 68 actions are still marked [ ] uncomplete.
The new REST routes already exist (/api/estimates, /api/clients, /api/employees, 
/api/upload, /api/app-settings/all, /api/quickbooks/projects, etc.) and the 
serializers in /lib/serializers/ are wired up. The webhook is still alive only 
because the FRONTEND was never migrated.

There are exactly 90 call sites across 51 files that still POST to 
/api/webhook/devcoBackend. Find them all:

  grep -rn "'/api/webhook/devcoBackend'" "/Users/adeeljabbar/Downloads/Code Library/devcocrm" \
    --include="*.tsx" --include="*.ts"

For each call site:
  1. Identify the `action` string in the request body.
  2. Look it up in /docs/DEVCOBACKEND_INVENTORY.md to find the new REST endpoint.
  3. Replace the fetch() with a call to the new endpoint using the proper HTTP verb.
     - READ actions → GET with query params
     - WRITE actions → POST/PATCH/DELETE on the entity's REST path
  4. If the corresponding REST route doesn't exist yet, create it (mirror the 
     existing handler from devcoBackend, run it through the serializer in 
     /lib/serializers/<entity>.ts, add the appropriate revalidateTag calls).
  5. Update the inventory checkbox to [x] with the new path.

After all 90 callers are migrated:
  - Confirm zero matches remain for `'/api/webhook/devcoBackend'`.
  - Delete /app/api/webhook/devcoBackend/route.ts entirely.
  - Update /docs/DEVCOBACKEND_INVENTORY.md to mark "All actions migrated, 
    webhook deleted on <date>".

VERIFY:
  1. npm run build passes with 0 errors.
  2. Open /clients, /employees, /jobs/schedules, /estimates, /tasks → all load 
     and behave identically.
  3. Network tab shows ZERO POSTs to /api/webhook/devcoBackend on any page.
  4. After mutating an entity, the corresponding list page reflects the change 
     within 1 second (revalidateTag working).

Estimated: 1-2 days of focused work. Do this in batches by entity (estimates 
first, then clients, then employees, etc.). Commit after each batch.
```

### PROMPT FU.2 — Strip every `revalidateTag(tag, undefined as any)` hack

```
There are 47 instances of `revalidateTag(<tag>, undefined as any)` across the 
codebase. The second argument is invalid — `revalidateTag` takes a single 
string. The cast was inserted to silence a TypeScript error.

STEP 1: Update Next.js types (the original error was probably a stale type def):
  npm install next@latest

STEP 2: Find every instance:
  grep -rn "revalidateTag.*undefined as any" "/Users/adeeljabbar/Downloads/Code Library/devcocrm" --include="*.ts"

STEP 3: For each match, change:
  revalidateTag('some-tag', undefined as any)
to:
  revalidateTag('some-tag')

STEP 4: Run `npx tsc --noEmit` (with NODE_OPTIONS="--max-old-space-size=6144"). 
If real type errors surface, fix them properly. If `revalidateTag` is somehow 
not exported correctly from 'next/cache', confirm the import line:
  import { revalidateTag } from 'next/cache';

STEP 5: While you're in each file, audit: does this mutation invalidate ALL 
the right tags?
  - Editing an Employee → revalidateTag('employees-list'), revalidateTag(`employee-${id}`), revalidateTag(`permissions-${userId}`)
  - Editing a Schedule → revalidateTag('schedules-list'), revalidateTag(`schedule-${id}`), revalidateTag(`dashboard-week-${weekId}`), revalidateTag('schedule-counts'), revalidateTag('wip-calculations')
  - Editing a Client → revalidateTag('clients-list'), revalidateTag(`client-${id}`)
  - Editing an Estimate → revalidateTag('estimates-list'), revalidateTag(`estimate-${id}`), revalidateTag('wip-calculations'), revalidateTag('quickbooks-projects')
  - Editing/creating a Task → revalidateTag('tasks-list'), revalidateTag(`tasks-user-${assignedTo}`), revalidateTag(`dashboard-week-${weekId}`)

VERIFY: zero matches for `undefined as any` near revalidateTag. tsc passes clean.
```

### PROMPT FU.3 — Move `playwright-core` to devDependencies

```
Open /package.json line 87. `playwright-core` is in `dependencies` but should 
be in `devDependencies`. This adds ~100 MB to every production deployment.

Run:
  npm uninstall playwright-core
  npm install --save-dev playwright-core@^1.57.0

Confirm package.json now shows playwright-core ONLY in devDependencies.
Run `npm run build` and confirm bundle size drops.
```

### PROMPT FU.4 — Gate Schedule model hot-reload to development only

```
Open /lib/models/Schedule.ts lines 340-341. Currently:

  delete mongoose.models.Schedule;
  ...

This runs unconditionally and re-registers the model on every serverless cold 
start in production, which triggers index re-sync. Expensive.

Change to match the pattern in /lib/models/Client.ts line 101:

  if (process.env.NODE_ENV === 'development') {
      delete mongoose.models.Schedule;
  }

Audit all other files in /lib/models/ for the same anti-pattern. Apply the 
same gate to any unconditional `delete mongoose.models.X`.
```

### PROMPT FU.5 — Remove phantom Schedule indexes

```
Open /lib/models/Schedule.ts. Look at the index declarations around lines 
335-338. These reference fields that DO NOT EXIST on the schema:

  ScheduleSchema.index({ customerId: 1, scheduledDate: -1 });  // neither field exists
  ScheduleSchema.index({ scheduledDate: -1 });                  // doesn't exist
  ScheduleSchema.index({ status: 1, scheduledDate: -1 });       // neither exists

The actual fields are `customerName`, `fromDate`, and there's no top-level 
`status` on Schedule. Mongoose silently fails to create these indexes. 

Either:
  a) DELETE these three index lines if they were aspirational.
  b) Replace with the correct field names that actually exist:
     - { customerName: 1, fromDate: -1 }
     - { fromDate: -1 }
     - any status field that actually exists in the schema (check the schema first)

Run `node -e "require('./lib/db'); const m = require('./lib/models/Schedule'); 
m.default.syncIndexes().then(r => console.log(r))"` (adapt to your project) 
and confirm the new index list matches your schema.

Then check the queries: /api/schedules and /api/dashboard query Schedule by 
{ fromDate, assignees, projectManager }. Confirm there's a matching compound 
index for the most common query shape. If not, add:
  ScheduleSchema.index({ fromDate: 1, assignees: 1 });
  ScheduleSchema.index({ fromDate: 1, projectManager: 1 });
```

### PROMPT FU.6 — Wire per-user permission invalidation

```
Open /app/api/roles/route.ts. Lines 125, 242, 318 currently call 
revalidateTag('permissions-all'). This nukes everyone's permission cache when 
ANY single role changes — wasteful.

For each mutation that affects roles:
  1. Identify which user IDs are affected. If a Role document is updated, find 
     all Employees with `role` = that role's id (Employee.find({ role: roleId }).select('_id')).
  2. For each affected userId, call revalidateTag(`permissions-${userId}`).
  3. Keep revalidateTag('permissions-all') ONLY for cases that genuinely affect 
     everyone (e.g., a global permission grant).

Then open /app/api/employees/[id]/route.ts (or wherever employee role is updated). 
On any PATCH that changes the `role` field, call revalidateTag(`permissions-${id}`).

VERIFY: edit one employee's role; confirm only that user's next page navigation 
re-fetches permissions. Other users' caches stay warm.
```

### PROMPT FU.7 — Migrate the remaining 6 list pages to DataTable + SWR

```
Following the pattern already established by ClientsTable and EmployeesTable, 
migrate these list pages to use the shared <DataTable> + factory hooks from 
/lib/hooks/api/index.ts:

  - /app/(protected)/jobs/schedules/SchedulesTable.tsx → useInfiniteSchedules + DataTable
  - /app/(protected)/estimates/EstimatesTable.tsx → useInfiniteEstimates + DataTable
  - /app/(protected)/tasks/* → useInfiniteTasks + DataTable
  - /app/(protected)/catalogue/* → useInfiniteCatalogue + DataTable
  - /app/(protected)/constants/* → useInfiniteConstants + DataTable
  - /app/(protected)/contacts/* → useInfiniteContacts + DataTable

For each:
  1. Strip the manual useState/useEffect/fetch pagination code.
  2. Define the column config (the existing table's <th> + <td> structure 
     translates almost 1:1 to columns: Array<ColumnConfig>).
  3. Define the mobileCard renderer for viewports < 768px.
  4. Wire up search input to the `q` query param with debounce.
  5. Wire up bulk actions to the selection prop.

VERIFY:
  - Each page loads visually identical to before.
  - Search, sort, pagination, mobile cards all work.
  - npm run build passes.
  - Network tab on each page shows the new GET /api/<entity> instead of 
    POST /api/webhook/devcoBackend (this depends on FU.1 being done first).
```

### PROMPT FU.8 — Migrate the 8 Estimate Add Dialogs to EntityFormModal

```
The 8 Catalogue Add Dialogs were successfully migrated to <EntityFormModal>. 
Apply the same pattern to the 8 Estimate Add Dialogs in 
/app/(protected)/estimates/[slug]/components/. They are currently ~3,734 lines 
of duplicated form code.

Use the Catalogue migration as the template. Each dialog becomes:
  - A field config array (~30-50 lines).
  - A thin wrapper that calls <EntityFormModal fields={config} ... />.
  - Initial data and onSubmit handler.

VERIFY: open each estimate dialog, save a record, confirm field validation 
and submission match the previous behavior exactly. LOC count should drop 
~3,000.
```

### PROMPT FU.9 — Finish the date formatter migration

```
174 inline date formatters remain across 64 files. Goal: replace them all 
with the wall-clock helpers from /lib/format/date.ts (or the <WallDate> / 
<WallTime> / <WallDateTime> components from /components/ui/DateDisplay.tsx).

Find candidates:
  grep -rn "new Date(.*).toLocale" "/Users/adeeljabbar/Downloads/Code Library/devcocrm" --include="*.tsx" --include="*.ts"
  grep -rn "format(parseISO" "/Users/adeeljabbar/Downloads/Code Library/devcocrm" --include="*.tsx" --include="*.ts"
  grep -rn ".toLocaleDateString\|.toLocaleTimeString\|.toLocaleString" "/Users/adeeljabbar/Downloads/Code Library/devcocrm" --include="*.tsx"

For each match:
  - If displaying a date → <WallDate value={x} /> or formatWallDate(x)
  - If displaying a time → <WallTime value={x} /> or formatWallTime(x)
  - If displaying both → <WallDateTime value={x} /> or formatWallDateTime(x)
  - If displaying a range → <WallRange start={x} end={y} /> or formatWallRange(x, y)

DO NOT REPLACE these (they correctly need timezone-aware logic):
  - /app/api/cron/daily-summary/route.ts getTodayPT
  - createdAt/updatedAt audit log displays where the user actually wants 
    "this happened at this real moment" (ASK before changing)

Hot spots to prioritize: payroll (13), schedules (5), receipts (5), 
dashboard (7), estimates (3).

VERIFY: visual diff a representative date display before and after; confirm 
identical output. Switch browser timezone to Asia/Karachi and back to 
America/Los_Angeles, confirm displayed wall-clock value doesn't change.
```

### PROMPT FU.10 — Quick cleanup: debug log + dashboard split + empty index check

```
Three small jobs:

1. Open /app/api/schedules/route.ts line 135. Remove or gate the debug log:
   console.log('FETCHED SCHEDULE:', ...);
   This fires on every schedule fetch in production.

2. Dashboard split (continuing P3.3):
   /app/(protected)/dashboard/page.tsx is still 4,539 lines. Extract these 
   sections into /app/(protected)/dashboard/_components/:
   - WeekPicker.tsx (the date-range pill at the top)
   - ScheduleStrip.tsx (the horizontal week strip)
   - TaskList.tsx (the assigned-to-me tasks panel)
   - StatsCards.tsx (the Quick Stats cards)
   - ChatWidget.tsx (the chat panel)
   - SchedulesGrid.tsx (the main schedules grid)
   Each child component fetches its own slice of /api/dashboard via SWR. Use 
   <Suspense> boundaries so they stream in independently.

3. Audit /lib/models/*.ts for any other field-less indexes (like the phantom 
   Schedule indexes in FU.5). For each model, list its actual schema fields 
   and confirm every Schema.index() reference matches an existing field.

VERIFY: dashboard renders identically. /api/schedules logs no longer noisy 
on every fetch. tsc passes.
```

---

## SUGGESTED ORDER

If you do these in order, the gains compound:

1. **FU.3** (5 min) — instant deploy savings
2. **FU.4 + FU.5** (15 min) — fixes Schedule perf
3. **FU.10 #1** (2 min) — quiet the logs
4. **FU.6** (30 min) — proper permission cache
5. **FU.2** (1 hour) — clean the cast hacks, surface real bugs
6. **FU.1** (1-2 days) — kill the webhook monolith ← biggest impact
7. **FU.7** (1 day, depends on FU.1) — migrate list pages
8. **FU.8** (4 hours) — kill estimate dialog dupes
9. **FU.9** (2-4 hours) — finish date migration
10. **FU.10 #2** (4 hours) — finish dashboard split

**Quick wins (do today):** FU.3, FU.4, FU.5, FU.10 #1, FU.6 — under 1 hour total, big impact.

**Real refactor (block out a week):** FU.1 + FU.2 + FU.7 — these together finally deliver the speed and consistency wins the master audit promised.
