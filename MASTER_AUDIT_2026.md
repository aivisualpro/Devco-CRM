# MASTER AUDIT — DevCo CRM (April 2026)

> Four parallel audits ran across the codebase: **components**, **data
> consistency**, **performance**, and **state management**. This document is the
> consolidated result and the action plan.

---

## TL;DR — Why your app feels broken

You have **three root causes**, and every symptom you've felt comes from one of
them:

1. **No single source of truth.** The same entity (Client, Employee, Schedule,
   Estimate) is fetched through 2–3 different endpoints that return different
   field sets. The frontend then copies server data into local `useState` and
   mutates it without invalidating the cache. That's why the same record looks
   different on different pages.

2. **No reusable primitives.** ~8,795 lines of duplicated component code. Eight
   near-identical "Add Item" dialogs. Eight near-identical line-item tables.
   Twelve modal patterns. 494 places where dates are formatted inline. When you
   change one, the other seven drift.

3. **The `/api/webhook/devcoBackend` monolith.** A single 3,000+ line route
   handles 50+ actions across estimates, clients, employees, templates,
   catalogs, uploads. It bypasses HTTP caching (POSTs are never cached),
   bypasses `revalidateTag`, and bypasses any field/permission consistency. ~30%
   of your data flow goes through this one file.

Fix these three, and the speed + consistency problems mostly go away.

---

## SCORECARD

| Area                            | Grade  | One-line verdict                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------------- |
| Component reuse                 | **F**  | 8 versions of every dialog. 8,795 lines of dupes.                   |
| Data consistency                | **D**  | Same entity, different shapes per endpoint. No invalidation.        |
| API surface                     | **D**  | Webhook monolith + N+1 queries + unbounded finds.                   |
| State management                | **D-** | No global store. 5 fetch strategies mixed per page.                 |
| Performance baseline            | **D+** | 5–10s dashboard loads, 6s permissions endpoint.                     |
| Build hygiene                   | **C+** | Builds clean, but `playwright` in deps, `revalidateTag` cast hacks. |
| Phase 1–10 work done previously | **C**  | Indexes added but unverified. SWR added but bypassed everywhere.    |

---

## CRITICAL FINDINGS (the blockers)

### 🔴 BLOCKER 1 — Password hash leak in `/api/employees`

`/app/api/employees/route.ts` returns the `password` field in plaintext (hash).
The webhook variant `getEmployees` correctly redacts it. **This is a security
hole, not just an inconsistency.** Anyone with the employee list endpoint can
harvest hashes.

**Fix immediately:** add `.select('-password -refreshToken')` to every Employee
query in that route.

### 🔴 BLOCKER 2 — Schedule N+1 with looped Employee lookups

`/app/api/schedules/route.ts` lines 361, 402, 756, 955, 978 each do
`Employee.find()` inside a loop over schedules. A dashboard with 30 schedules =
30 sequential queries. This is your single biggest dashboard latency
contributor.

### 🔴 BLOCKER 3 — Client schema vs index mismatch (silent corruption)

`Client` model defines `contacts[]` array. The indexes and several queries
reference `primaryContact.firstName`, `primaryContact.email` — fields that don't
exist on the schema. Indexes don't apply, queries silently return wrong/empty
results, frontend works around it with try/catch + fallbacks.

### 🔴 BLOCKER 4 — Permissions endpoint takes 6 seconds

`/api/auth/me/permissions` is supposed to be cached (`lib/permissions/cache.ts`)
but in dev it takes 6.1s on every page load. Three issues:

- The in-process Map cache dies between serverless invocations in production.
- The cache key may not include role version, so role updates aren't
  invalidated.
- No `Cache-Control` HTTP header set, so the browser refetches every navigation.

### 🔴 BLOCKER 5 — `/api/vitals` blocks for 5+ seconds

Web-vitals reporting awaits a Mongo write instead of fire-and-forget. Ironic:
the endpoint that measures slowness causes slowness. Should use `sendBeacon` on
the client and return `204` immediately on the server.

### 🔴 BLOCKER 6 — POST routes used as GETs

60+ "actions" through `/api/webhook/devcoBackend` are read-only but use POST.
POSTs bypass every layer of caching (browser, CDN, Vercel edge, SWR dedupe).
This is why fetching employees the second time is just as slow as the first.

---

## DUPLICATION HALL OF SHAME

These are immediate consolidation wins. Numbers are real LOC counts from the
audit.

| Group                                                                                         | Count      | LOC    | Consolidation target                                            |
| --------------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| Estimate "Add Item" dialogs                                                                   | 8          | 3,734  | One `<AddItemDialog>` + column config                           |
| Catalogue "Add Item" dialogs                                                                  | 8          | 2,256  | Same target as above                                            |
| Line-item tables (Material, Labor, Equipment, Tools, Overhead, Subcontractor, Disposal, Misc) | 8          | 2,805  | One `<GenericLineItemsTable>` + column config                   |
| Modal form components (Schedule, DJT, JHA, …)                                                 | 12         | ~3,000 | One `<EntityFormModal>` with config                             |
| Date formatters (inline `toLocaleDateString` etc.)                                            | 494        | —      | `lib/format/date.ts` + `<DateDisplay>`                          |
| Status badges                                                                                 | 30+        | —      | `<StatusBadge variant>`                                         |
| Avatar/user chips                                                                             | 10+        | —      | `<UserChip user>`                                               |
| Empty states                                                                                  | 15+        | —      | `<EmptyState icon title cta>` (already exists, just enforce it) |
| Loading spinners                                                                              | 5 variants | —      | `<Spinner size>`                                                |
| Page headers                                                                                  | 20+        | —      | `<PageHeader title actions>`                                    |

**Total: ~8,795 lines of duplicated code that could collapse to ~1,500 lines.**
Three sprints of ruthless consolidation.

---

## DATA INCONSISTENCY HOTSPOTS

| Inconsistency                                                                                                                   | Why it hurts                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/api/employees` exposes password hash; webhook `getEmployees` redacts                                                          | Security + different rendering depending on path                               |
| `/api/clients` returns paginated list; webhook `getClients` returns full list                                                   | Pagination breaks; counts don't match                                          |
| Estimates have NO dedicated REST route — all access through webhook with 2 different response shapes                            | Detail page and list page show different fields                                |
| Schedule "today" computed with UTC offset on detail page vs `Intl.DateTimeFormat('America/Los_Angeles')` on dashboard           | Different lists for "today" depending on which page                            |
| Total hours computed in 4 places with slightly different rules (rounding, drive-vs-site split)                                  | Timesheet totals don't match between tabs                                      |
| Tasks list has NO permission filtering; schedules has filtering by `projectManager`/`foremanName`/`assignees`; clients has none | Different users see different counts; admins and FMs see different "all" lists |
| Detail pages mutate `useState` after PATCH; never call SWR `mutate()` or `revalidateTag()`                                      | Edit on detail page; list page still shows old value until hard refresh        |

---

## STATE MANAGEMENT FRAGMENTATION

Per-page fetch strategy count (mixing within a page = bug):

| Page              | RSC | useSWR | useEffect+fetch | Direct fetch in handler | webhook POST | Strategies mixed?                    |
| ----------------- | --- | ------ | --------------- | ----------------------- | ------------ | ------------------------------------ |
| /dashboard        | –   | ✓      | ✓               | ✓                       | ✓            | **4 mixed**                          |
| /clients          | ✓   | ✓      | ✓               | ✓                       | –            | **4 mixed**                          |
| /employees        | ✓   | ✓      | ✓               | –                       | ✓            | **4 mixed**                          |
| /estimates        | ✓   | –      | ✓               | –                       | ✓            | **3 mixed + sessionStorage**         |
| /schedules        | –   | –      | ✓               | ✓                       | ✓            | **3 mixed, 50+ useState**            |
| /settings/general | –   | –      | ✓ × 5           | ✓                       | –            | **5 cascading fetches per tab open** |

No global state library. No `createContext` for current user / permissions /
settings. Current user email lives in `localStorage` (stale after logout).

---

# ACTION PLAN — Prompts to feed your AI agent

Run these in **strict order**. Each prompt is self-contained, tells the agent
exactly which files to touch, and ends with verification steps. Do **NOT skip
ahead** — later prompts assume earlier ones are done.

---

## P0 — Stop the bleeding (do today, in this order)

### PROMPT P0.1 — Fix the password leak

```
Open /app/api/employees/route.ts. On every Employee query (find, findOne, findById, aggregate), add .select('-password -refreshToken -__v'). 
Also do the same in:
- /app/api/auth/me/route.ts
- /app/api/auth/me/permissions/route.ts
- Any /app/api/employees/** subroutes
- Any place in /lib that returns Employee documents to API responses
After the change, grep the entire repo for `Employee.find` and `Employee.findOne` and confirm every single one either has .select() that excludes password OR is inside a server-only auth check (login, password reset).
Verify by curling /api/employees and confirming the response has NO `password` field.
```

### PROMPT P0.2 — Make /api/vitals fire-and-forget

```
Open /app/api/vitals/route.ts. The handler currently awaits a DB write and blocks for 5+ seconds. Change it to:

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  // Fire and forget — do not await
  if (data) {
    void connectToDatabase().then(() => Vital.create(data)).catch(err => console.error('[vitals] write failed', err));
  }
  return new Response(null, { status: 204 });
}

Then in the client (find every place that reports vitals — likely lib/web-vitals.ts or app/(protected)/layout.tsx), switch to navigator.sendBeacon('/api/vitals', JSON.stringify(metric)) with a fallback to fetch with { keepalive: true }.

Verify: open /dashboard, watch the network tab — POST /api/vitals should return 204 in under 50ms.
```

### PROMPT P0.3 — Cache the permissions endpoint properly

```
Open /lib/permissions/cache.ts and /app/api/auth/me/permissions/route.ts.

The current in-process Map cache doesn't survive serverless invocations. Replace it with Next.js's unstable_cache and tag-based invalidation:

1. Wrap the loader in unstable_cache(loader, [`permissions-${userId}`], { tags: [`permissions-${userId}`, 'permissions-all'], revalidate: 300 }).
2. Add Cache-Control: 'private, max-age=60, stale-while-revalidate=300' header to the route response.
3. In every place that mutates roles or user.role (search /app/api/roles/** and /app/api/employees/** for PATCH/PUT/DELETE), call revalidateTag(`permissions-${affectedUserId}`) — and revalidateTag('permissions-all') for role-level changes.

Verify: hard-refresh /dashboard twice in a row. The second /api/auth/me/permissions request must return in <50ms with `x-vercel-cache: HIT` (in production) or be cached in browser (Cache-Control honored).
```

### PROMPT P0.4 — Fix Schedule N+1 with batched lookups

```
Open /app/api/schedules/route.ts. Find every location where the code loops over schedules and calls Employee.find() inside the loop — confirmed lines: 361, 402, 756, 955, 978.

Refactor pattern (apply to all 5 sites):

BEFORE:
for (const sched of schedules) {
  const employees = await Employee.find({ email: { $in: sched.assignees } }).select('firstName lastName email');
  ...
}

AFTER (batch + map):
const allAssigneeEmails = [...new Set(schedules.flatMap(s => s.assignees || []))];
const employees = await Employee.find({ email: { $in: allAssigneeEmails } }).select('firstName lastName email').lean();
const empMap = new Map(employees.map(e => [e.email.toLowerCase(), e]));
for (const sched of schedules) {
  const enriched = (sched.assignees || []).map(a => empMap.get(a.toLowerCase()));
  ...
}

Also add .lean() and .select() everywhere they're missing. Then add a compound index in /lib/models/Schedule.ts: ScheduleSchema.index({ fromDate: 1, assignees: 1 }) and re-sync indexes (run a one-off Schedule.syncIndexes()).

Verify: warm /api/schedules with 30+ schedules in the date range, confirm Mongo profiler shows ONE Employee.find call instead of 30.
```

### PROMPT P0.5 — Fix the Client schema/index mismatch

```
Open /lib/models/Client.ts. The schema defines `contacts[]` array. Some indexes and queries reference `primaryContact.firstName`, `primaryContact.email`, etc. — fields that don't exist on the schema.

Pick ONE source of truth:

OPTION A (recommended, minimal blast radius): Add a virtual `primaryContact` getter that returns `contacts[0]`. Then keep all code that reads `primaryContact.*` working. Update indexes that reference `primaryContact.*` to instead use `contacts.0.email`, `contacts.0.firstName`, or remove them entirely (a virtual cannot be indexed).

OPTION B (more correct, more work): Migrate the schema to use a single `primaryContact` subdocument and a separate `additionalContacts[]` array. Write a migration script for existing data.

Pick A. Then grep the whole repo for `primaryContact.` and `contacts.` and confirm every read works against whichever shape you ended on.

Verify: GET /api/clients?q=<some name> returns hits. PATCH a client's primary contact, GET it back, confirm the new value is returned (not the old one).
```

---

## P1 — Stop the proliferation (this week)

### PROMPT P1.1 — Build the shared `<DataTable>` and migrate one page as proof

```
Create /components/data-table/DataTable.tsx — a single generic table that all list pages will use. Required features:

Props:
- columns: Array<{ key: string; header: string; cell: (row: T) => ReactNode; width?: string; sortable?: boolean }>
- data: T[]
- isLoading: boolean
- isLoadingMore: boolean
- hasMore: boolean
- onLoadMore: () => void
- emptyState: { icon: ReactNode; title: string; description?: string; cta?: ReactNode }
- onRowClick?: (row: T) => void
- selection?: { selected: Set<string>; onChange: (next: Set<string>) => void; rowKey: (row: T) => string }
- toolbar?: ReactNode (search input, filters, bulk actions)
- mobileCard?: (row: T) => ReactNode (renders a card on viewport < 768px instead of a row)

Use shadcn/ui Table primitives. Mobile breakpoint via Tailwind md: classes — desktop = table, mobile = stacked cards.

Then migrate ONE page to use it as a proof: pick /app/(protected)/clients/page.tsx (or its ClientsTable component). Replace the existing table with DataTable + a column config. Confirm visual parity, sorting, pagination, mobile rendering all work.

Save a short MIGRATION_GUIDE.md showing the before/after pattern. Future migration of /employees, /schedules, /estimates, /tasks, /catalogue follows the same pattern.

Verify: npm run build passes. Visual diff vs before is identical. Mobile viewport (375px) shows cards not table.
```

### PROMPT P1.2 — Build the shared `<EntityFormModal>` and consolidate Add-Item dialogs

```
You currently have 8 Estimate Add Dialogs (3,734 lines) and 8 Catalogue Add Dialogs (2,256 lines) — 16 dialogs that are 95-98% identical. Total: 5,990 lines.

Create /components/forms/EntityFormModal.tsx with this signature:

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'multiselect' | 'date' | 'currency' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  validation?: ZodType;
  defaultValue?: any;
  placeholder?: string;
  help?: string;
  width?: 'full' | 'half' | 'third';
}

interface EntityFormModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FieldConfig[];
  initialData?: Partial<T>;
  onSubmit: (data: T) => Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

Implement using react-hook-form + zod (already in deps). Render fields in a responsive grid based on `width`. Handle validation, error display, submit state, dirty-form warning on close.

Then consolidate the 16 add-dialogs into config objects. Each old dialog becomes a ~30-line file that exports the field config and a thin wrapper. Delete the old files only after all 16 are replaced.

Verify: npm run build passes. Open each replaced dialog in the UI, confirm visual + functional parity. LOC count should drop by ~5,000.
```

### PROMPT P1.3 — Build the shared `<GenericLineItemsTable>` and consolidate 8 line-item tables

```
You have 8 near-identical line-item tables across /app/(protected)/estimates/[slug]/components/: MaterialLineItems, LaborLineItems, EquipmentLineItems, ToolsLineItems, OverheadLineItems, SubcontractorLineItems, DisposalLineItems, MiscellaneousLineItems. Total: 2,805 lines, 99% duplicate.

Create /components/line-items/GenericLineItemsTable.tsx that takes:

interface LineItemColumnConfig {
  key: string;
  header: string;
  type: 'text' | 'number' | 'currency' | 'percent' | 'select';
  editable: boolean;
  computed?: (row: any, allRows: any[]) => any; // for derived columns like "total = qty * rate"
  options?: string[]; // for select
  align?: 'left' | 'right' | 'center';
}

interface GenericLineItemsTableProps {
  columns: LineItemColumnConfig[];
  rows: any[];
  onRowsChange: (rows: any[]) => void;
  onAddRow: () => void;
  onDeleteRow: (index: number) => void;
  showTotals?: boolean;
  totalsConfig?: { sumColumns: string[] };
  readOnly?: boolean;
}

Then replace all 8 tables with this generic + 8 small column-config exports. Each table file goes from 298-430 lines to ~50.

Verify: open an estimate, edit material line items, save. Reload, confirm values persisted. Repeat for each of the 8 categories. Numeric totals must match what the old table showed.
```

### PROMPT P1.4 (corrected) — Wall-clock date formatter consolidation

DESIGN CONTRACT (do not violate):

- All user-facing timestamps in this app are "wall-clock / floating" — the date
  and time captured on the device must display IDENTICALLY for every viewer
  regardless of their timezone. A schedule saved as "04/25/2026 5:00 PM" in
  Karachi must show as "04/25/2026 5:00 PM" in Los Angeles.
- The existing pattern in lib/timeCardUtils.ts is correct: store as string OR as
  a fake-UTC ISO whose UTC components equal the captured wall-clock components.
  Display by extracting string components via regex — NEVER call new
  Date(x).toLocaleString() or Intl.DateTimeFormat() on these values, because
  both will convert.

STEP 1 — Create /lib/format/date.ts as the single source of truth. Move and
extend the existing helpers from lib/timeCardUtils.ts. Export:

- normalizeWallClock(input: string | Date | undefined): string\
  Returns ISO string "YYYY-MM-DDTHH:mm:ss.000Z" where the Z is FAKE (the value
  represents wall-clock, not UTC). Handles inputs:
  - "M/D/YYYY h:mm:ss AM/PM"
  - "YYYY-MM-DDTHH:mm"
  - real Date objects (extract components in their captured locale, NOT in
    viewer locale)
  - empty/undefined → ''

- formatWallDate(input, variant?: 'short'|'long'|'iso'): string variant 'short'
  → "04/25/2026" variant 'long' → "Saturday, April 25, 2026" variant 'iso' →
  "2026-04-25" Implementation: regex-extract components from normalizeWallClock
  output. Build the string manually. NEVER call toLocaleDateString.

- formatWallTime(input, opts?: { seconds?: boolean }): string Returns "5:00 PM"
  or "5:00:07 PM" — manually built from extracted hour/minute/second.

- formatWallDateTime(input, opts?): string Returns "04/25/2026 5:00 PM"

- formatWallRange(start, end): string Returns "04/25/2026 5:00 PM – 7:30 PM"
  (same day) or "04/25/2026 5:00 PM – 04/26/2026 9:00 AM" (multi-day)

- toWallClockISO(date: Date): string When the user clicks "5pm" in a date picker
  (which gives you a real Date in their browser timezone), call this to convert
  it to the fake-UTC string before sending to the server. Implementation: new
  Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(),
  d.getMinutes(), d.getSeconds())).toISOString() This forces the UTC components
  to match the local components.

STEP 2 — Create /components/ui/DateDisplay.tsx as a thin React wrapper:
<WallDate value={s.fromDate} />
<WallTime value={ts.clockIn} />
<WallDateTime value={s.fromDate} />
<WallRange start={s.fromDate} end={s.toDate} /> Each just calls the formatter
and renders <span>{formatted}</span>. Optional `className`, `fallback="—"`.

STEP 3 — Codemod the 494 inline date formattings. Find every call to:

- new Date(x).toLocaleDateString(...)
- new Date(x).toLocaleTimeString(...)
- new Date(x).toLocaleString(...)
- format(parseISO(x), ...) (date-fns)
- any inline date manipulation that uses getMonth/getDate/getHours from a real
  Date Replace with the appropriate <WallDate> / <WallTime> / formatter call.

DO NOT replace these (they ARE supposed to convert):

- The cron daily-summary's getTodayPT() — that one legitimately needs Pacific
  Time today's date for filtering "today's schedules" against the database.
- createdAt / updatedAt audit log displays where the user wants to know "the
  moment in real time" (these are usually fine to convert, but ASK before
  touching).
- Anything that compares two timestamps for "duration" — duration math IS
  independent of timezone if both are wall-clock fake-UTC, so the math actually
  works correctly with simple subtraction. Confirm before changing.

STEP 4 — Date pickers must emit wall-clock strings. Find every
<input type="date">, <input type="datetime-local">, and any custom date picker
used in forms. On change, the value comes back as a Date in browser-local time.
Wrap every onChange with toWallClockISO() before storing in form state.
Otherwise saves from Pakistan will still go to Mongo as 12:00:00.000Z while the
user sees 5:00 PM.

STEP 5 — Migrate Schedule.fromDate/toDate (and similar Date-typed fields) to be
wall-clock-stored. This is the bigger fix. Schedule.fromDate is currently
`type: Date`. Two options: OPTION A (no migration): Keep type: Date, but enforce
that EVERY save calls toWallClockISO() first. New writes will be consistent;
legacy data is already however it was saved (it's already in your DB and the
existing display layer should treat its UTC components AS wall-clock — which is
what robustNormalizeISO already does). OPTION B (cleaner): Change type to String
and store the formatted wall-clock string directly. Run a one-shot migration
script that converts existing Date values to their wall-clock string equivalent.
Pick OPTION A — minimum blast radius. Document the contract in a JSDoc comment
at the top of /lib/models/Schedule.ts.

STEP 6 — Date range queries (Schedule.find({ fromDate: { $gte, $lte } })). These
currently work because the frontend passes ISO strings that match the fake-UTC
values stored. Confirm by inspecting /api/schedules and /api/dashboard query
params and the date construction. As long as both sides treat the timestamps as
wall-clock-fake-UTC, $gte/$lte comparisons work correctly. Do NOT introduce any
timezone conversion in the query layer.

VERIFY:

1. Save a schedule with fromDate "04/25/2026 5:00 PM" while your browser is set
   to Asia/Karachi timezone (devtools > sensors > location).
2. Switch your browser to America/Los_Angeles timezone.
3. Hard-refresh /schedules. The schedule must still display "04/25/2026 5:00 PM"
   — NOT "04/25/2026 5:00 AM" or any converted value.
4. Save a clockIn from Karachi, view from LA — same string.
5. Cron daily-summary should still pick up today's schedules for the LA business
   day (because that ONE flow legitimately uses PT-aware logic in getTodayPT —
   which is correct for "what is today's date for the daily report").

### PROMPT P1.5 — Status badges, user chips, page headers, empty states

```
Build 4 small primitives in /components/ui/:

1. <StatusBadge status="active|inactive|pending|approved|rejected|in-progress|completed" variant?> — central color/icon mapping. Replace the 30+ inline badge implementations.

2. <UserChip user={{ email, firstName?, lastName?, avatar? }} size="sm|md|lg" /> — replace the 10+ inline avatar+name renderings. Use the existing employee map context (after P2.1 lands).

3. <PageHeader title actions? breadcrumbs? /> — replace the 20+ ad-hoc headers.

4. <EmptyState icon title description? cta? /> — already exists; enforce its use in the 15+ places that reinvent it inline.

Migrate at least 5 pages to each. Document the components in a /components/ui/README.md. Keep the migrations to ~200 lines per PR; do not rewrite the world in one commit.

Verify: build passes, pages look the same, future-you only edits one file when changing badge colors.
```

---

## P2 — Unify the data layer (next two weeks)

### PROMPT P2.1 — Kill `/api/webhook/devcoBackend` (split it into REST routes)

```
Open /app/api/webhook/devcoBackend/route.ts (3,000+ lines, 50+ actions). Inventory every action it handles. Group them by entity:

- Estimate actions → move to /app/api/estimates/route.ts (GET list, POST create) and /app/api/estimates/[id]/route.ts (GET one, PATCH, DELETE) and sub-resources as needed.
- Client actions → /app/api/clients/** (some already exist — merge logic)
- Employee actions → /app/api/employees/**
- Schedule stats / aggregations → /app/api/schedules/stats/route.ts
- Catalogue / templates → /app/api/catalogue/route.ts, /app/api/templates/route.ts
- Upload actions → /app/api/upload/route.ts (probably already exists)

Rules:
- READ actions become GET routes with query params. Add proper Cache-Control + use unstable_cache where appropriate.
- WRITE actions become POST/PATCH/DELETE on the appropriate resource path.
- Every write must call revalidateTag for the affected entity AND for any aggregate that depends on it (dashboard-week-XYZ tags).
- Use a single shared serializer per entity (in /lib/serializers/employee.ts, /lib/serializers/client.ts, etc.) so every endpoint returns the same shape.

Update every frontend caller. Grep for `'/api/webhook/devcoBackend'` and `action:` — replace each call with the new REST endpoint.

Once all callers are migrated, delete the webhook route. Do this incrementally — split one entity at a time, ship, then move to the next.

Verify: each migrated entity now has ONE endpoint serving ONE shape. Cache headers visible in DevTools. After a PATCH, GET returns updated value within 1s.
```

### PROMPT P2.2 — Single global app context (currentUser, permissions, settings)

```
You have NO global state. Currentuser email lives in localStorage. Permissions are refetched on every page. App settings are fetched piece-by-piece on every settings tab open.

Create /lib/context/AppContext.tsx — a single React Context provided in /app/(protected)/layout.tsx (which is already a client boundary or can be wrapped by one):

interface AppContextValue {
  currentUser: { email, firstName, lastName, role, avatar } | null;
  permissions: PermissionSet;
  settings: AppSettings; // includes all emailBot configs, billing config, workflow rules, etc.
  refreshUser: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

The provider:
- Fetches /api/auth/me, /api/auth/me/permissions, and /api/app-settings/all (a NEW consolidated endpoint that returns ALL app settings in one response) in parallel on mount.
- Uses SWR internally with long dedupe windows.
- Exposes typed hooks: useCurrentUser(), usePermissions(), useAppSettings(), useCan(action, scope).

Then refactor:
- Settings/general page: replace the 5 cascading fetches with one read from useAppSettings() and one PATCH to /api/app-settings/all.
- Every place that reads currentUser from localStorage: replace with useCurrentUser().
- Every place that does its own permission check: replace with useCan().

Verify: open /settings/general, network tab shows ONE /api/app-settings/all instead of 5+ calls. Switching tabs shows zero network activity (data already in memory).
```

### PROMPT P2.3 — Migrate every list page to SWR + the shared DataTable

```
After P1.1 (DataTable exists) and P2.1 (REST routes exist), migrate every list page off useEffect+fetch onto useSWR + DataTable.

Pages to migrate:
- /clients (already done in P1.1 as proof)
- /employees
- /schedules
- /estimates
- /tasks
- /catalogue
- /constants
- /contacts
- Any other list page

Pattern for each:
1. Use the existing factory in /lib/hooks/api/index.ts to add useXResource and useInfiniteXResource.
2. Render via <DataTable columns={...} {...listHook} />.
3. Add a search input wired to the `q` param with debounce.
4. Delete the old useState/useEffect/manual pagination code.

Verify: every list page now does one initial fetch, dedupes across components, supports load-more, and the mobile breakpoint shows cards.
```

### PROMPT P2.4 — Add cache invalidation to every mutation

```
Audit every mutation route (POST/PATCH/DELETE) under /app/api/**. For each, identify which cache tags should be invalidated:

- Mutating an Employee → revalidateTag('employees-list'), revalidateTag(`employee-${id}`), revalidateTag(`permissions-${userId}`)
- Mutating a Schedule → revalidateTag('schedules-list'), revalidateTag(`schedule-${id}`), revalidateTag(`dashboard-week-${weekId}`), revalidateTag('schedule-counts'), revalidateTag('wip-calculations')
- Mutating a Client → revalidateTag('clients-list'), revalidateTag(`client-${id}`)
- Mutating an Estimate → revalidateTag('estimates-list'), revalidateTag(`estimate-${id}`), revalidateTag('wip-calculations')
- Mutating a Task → revalidateTag('tasks-list'), revalidateTag(`tasks-user-${assignedTo}`), revalidateTag(`dashboard-week-${weekId}`)

Also fix the cosmetic hack: every existing call site does revalidateTag(tag, undefined as any) — that second argument is invalid. Remove it everywhere. If TypeScript complains, run npm i next@latest and regenerate types; do not silence the error with `as any`.

On the frontend, every successful mutation must call SWR's mutate() for the affected key. The shared hooks from /lib/hooks/api/index.ts already expose `mutate` — wire it up in form submit handlers.

Verify: edit a client's name on /clients/[id]. Navigate back to /clients. The new name is visible without a hard refresh.
```

---

## P3 — Pay down (next month)

### PROMPT P3.1 — Move bloat out of dependencies

```
package.json has these in dependencies that should be devDependencies or removed entirely:
- playwright, playwright-core (move to devDependencies — used only for tests)
- Any of: puppeteer, html2pdf.js, mammoth, react-quill-new, chart.js if still listed (check current state)

After moving, run npm install, npm run build, and npm run analyze (uses @next/bundle-analyzer). Compare client bundle size before/after. Target a 30%+ reduction on /estimates, /dashboard.

Also gate any dev-only logging behind process.env.NODE_ENV !== 'production'.
```

### PROMPT P3.2 — Add HTTP cache headers to lookup endpoints

```
Endpoints that return mostly-static lookup data should set proper Cache-Control headers. Audit:
- /api/catalogue — Cache-Control: 'public, s-maxage=300, stale-while-revalidate=3600'
- /api/constants — same
- /api/services — same
- /api/roles — Cache-Control: 'private, max-age=60, stale-while-revalidate=300'
- /api/auth/me — Cache-Control: 'private, max-age=60, stale-while-revalidate=300'

Verify in DevTools: second request to each endpoint shows `(disk cache)` or `x-vercel-cache: HIT`.
```

### PROMPT P3.3 — Break up the dashboard god component

```
/app/(protected)/dashboard/page.tsx is 4,941 lines with 60+ useState, 25+ useEffect, 30+ fetch calls. Split into composition:

- /dashboard/page.tsx → server component, renders <DashboardShell> with Suspense boundaries
- /dashboard/_components/WeekPicker.tsx (client)
- /dashboard/_components/ScheduleStrip.tsx (client, own SWR)
- /dashboard/_components/TaskList.tsx (client, own SWR)
- /dashboard/_components/StatsCards.tsx (client, own SWR)
- /dashboard/_components/ChatWidget.tsx (client, own SWR — and remove the 10s polling, use revalidateOnFocus instead)
- /dashboard/_components/SchedulesGrid.tsx
- Heavy modals (ScheduleFormModal, JHAModal, DJTModal, ScheduleDetailsPopup) → next/dynamic with ssr:false, only loaded when opened

Each section fetches its own slice of /api/dashboard. Use Suspense to stream them in independently. The page should be visually usable in <500ms even on a slow connection.

Verify: Lighthouse score on /dashboard improves by 15+ points. First-contentful-paint under 1s on Fast 3G.
```

---

## How to use this document

1. **Read top-to-bottom.** Don't cherry-pick prompts.
2. **Run prompts sequentially within each phase.** P0.1 before P0.2, etc.
3. **After every prompt, do the agent's "Verify" step yourself.** Don't trust "I
   implemented it" — open the network tab, refresh, and look.
4. **Commit after every prompt.** Small reversible commits beat one giant
   refactor PR.
5. **Track progress in TODO comments at the top of each route file.** When the
   file is fully migrated to the new pattern, delete the comment.

The four detailed audit reports (`audit_components.md`, `audit_consistency.md`,
`audit_performance.md`, `audit_state.md`) are in the temp outputs folder if you
want to dive into any single area.
