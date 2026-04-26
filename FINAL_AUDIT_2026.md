# FINAL AUDIT — DevCo CRM (April 2026)

> Three parallel audits ran after the FU.1–FU.10 prompts were marked complete. This is the consolidated verdict and the **last mile to "zero loading on any navigation."**

---

## TL;DR — You're 80% there

The architectural cleanup landed. The webhook monolith is gone. Cache invalidation hacks are stripped. Models are fixed. The codebase is in genuinely good shape.

**What's keeping you from your "zero loading" wish is configuration, not architecture.** Six config-level tweaks and one component swap will make navigation feel instant. The remaining duplication (date formatters, list-page DataTable migration) is cosmetic — fix it on a slower schedule.

| Area | Grade | Verdict |
|---|---|---|
| FU.1 — Webhook killed | **A** | 0 callers found, route deleted, inventory partial but archived |
| FU.2 — `revalidateTag` hacks stripped | **A** | 0 matches, tsc clean |
| FU.3 — playwright in devDeps | **A** | Already correct (the original audit was wrong) |
| FU.4 — Schedule HMR gated | **A** | Now matches Client.ts pattern |
| FU.5 — Phantom indexes fixed | **B** | Real fields referenced; minor schema oddity remains |
| FU.6 — Per-user permission invalidation | **C** | Tags wired but the calls have an invalid second arg `'default'` |
| FU.7 — DataTable migration | **D** | Only 2 of 8 list pages migrated (clients, employees) |
| FU.8 — Estimate dialogs migrated | **C** | Catalogue done, estimate dialogs unclear/incomplete |
| FU.9 — Date formatter migration | **C** | 240+ inline formatters remain (started, didn't finish) |
| FU.10a — Debug log removed | **F** | `console.log('FETCHED SCHEDULE:', ...)` still in `/api/schedules/route.ts:136` |
| FU.10b — Dashboard split | **C** | 3 of 6 planned `_components/` extracted |
| FU.11 — `AGENT.md` policy | **A** | In place, scratch/ cleaned |
| TypeScript build | **A** | 0 errors |

---

## 🔴 THE 8 BLOCKERS TO ZERO-LOADING NAVIGATION

These are in priority order. The first three give you ~70% of the perceived speed win. Total time to ship all 8: under 4 hours.

### 1. **`keepPreviousData: true` is missing from SWRConfig** [60 min impact, 5 min fix]
This single setting is the difference between "navigation feels instant" and "navigation flashes blank." When you navigate from `/clients` → `/clients/[id]` → back to `/clients`, SWR currently shows a blank state while refetching. With `keepPreviousData: true`, the old list stays visible while the fresh data loads in the background — perceived loading: **zero**.

### 2. **`<PrefetchLink>` exists but is never used** [225ms per nav, 30 min fix]
You built a custom prefetch-on-hover Link component. It has zero call sites. Every `<Link>` in the app uses the plain Next.js component, which only prefetches static routes. For dynamic routes (every detail page), nothing prefetches until you click. Replace `<Link>` with `<PrefetchLink>` in the sidebar nav, list-row links, and any "View Details" button.

### 3. **No `staleTimes` config in `next.config.ts`** [300ms per nav, 2 min fix]
Next 15+ defaults dynamic route segments to 0-second cache. Every navigation re-runs the RSC and the data fetch. Adding `experimental: { staleTimes: { dynamic: 30, static: 180 } }` keeps the rendered route in the client cache for 30 seconds after navigation, so back/forward is instant.

### 4. **Permissions endpoint hits per-user invalidation with broken second arg** [unfinished FU.6]
`/app/api/roles/route.ts:244` and `/app/api/employees/[id]/route.ts:43,56` call `revalidateTag('permissions-${id}', 'default')`. The string `'default'` is not a valid second argument — it's silently ignored at runtime, but it's the FU.2 hack pattern resurrected with a different value. Fix to single-arg form.

### 5. **`SchedulesTable` hard-fetches on mount** [~1000ms]
46 fetch calls and 3 useEffects refetch schedules + day-off stats + monthly activity on every mount, even though the parent page.tsx could fetch server-side and pass as `fallbackData`. Classic waterfall.

### 6. **`/reports/wip` is 100% client-side** [~1700ms]
The whole page is `'use client'` with no server prefetch. Every navigation to `/reports/wip` triggers a hard reload of QB projects. Convert to a hybrid: server-fetch the QB projects, pass to a client component as `fallbackData`, keep mutations client-side.

### 7. **`EmployeesTable` refetches roles on every mount** [~125ms]
Roles change rarely. A `useEffect(() => fetch('/api/roles'), [])` runs on every mount. The roles list should come from the server component as `fallbackData` (or live in `useAppSettings()`).

### 8. **No `experimental.viewTransition` enabled** [~250ms perceived]
React 19 + Next 16 support the View Transitions API for smooth CSS-based page transitions. Adding `viewTransition: true` to the experimental config eliminates the "flash of nothing" between routes.

---

## 🟡 OTHER THINGS LEFT ON THE TABLE

### Bundle weight (under 1 hour total)
- **TipTap editor (~150KB)** statically imported — wrap `RichTextEditor` in `next/dynamic` so it only ships when an estimate detail page actually opens an editor. Saves ~120KB on every page that imports the component.
- **Recharts (~200KB)** statically imported on `/reports/wip` — defer with `next/dynamic({ ssr: false })`. Recharts is only used on this one page; it shouldn't be in the main bundle at all.
- **PapaParse (~35KB)** static-imported on `/settings/imports` — only needed when the user clicks "Import CSV." Lazy-load on click.
- **Geist + Google fonts** loading in parallel — pick one. Adds ~30KB.
- **Lodash** — confirm `/lib/templateResolver.ts` does `import { sortBy } from 'lodash/sortBy'` not `import _ from 'lodash'`. The full lib is ~70KB.

Realistic bundle savings: **~150–200KB on first load**. With these + the 8 nav fixes above, your dashboard goes from ~5s perceived to under 500ms.

### Cleanup that didn't land
- `console.log('FETCHED SCHEDULE:', ...)` still firing on every fetch in `/app/api/schedules/route.ts:136`. Delete it.
- 240+ inline date formatters remain (FU.9 was ~65% done). Do this in batches when touching each file for other reasons; don't block on it.
- Dashboard split: 3/6 `_components/` extracted. Continue extracting (WeekPicker, ScheduleStrip, SchedulesGrid).

---

## ZERO-LOADING PROMPTS (paste in order, ~4 hours total)

### PROMPT Z.1 — The five-minute SWRConfig fix [biggest single win]

```
Open /lib/SWRProvider.tsx (or wherever <SWRConfig> is defined — search for SWRConfig).

The current value object lacks the most important setting for instant 
navigation: `keepPreviousData: true`. Add it.

Final config should look like this:

  const value = {
    fetcher: (url: string) => fetch(url).then(r => r.json()),
    dedupingInterval: 5000,
    focusThrottleInterval: 60000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    keepPreviousData: true,           // ← THIS — show old data while new loads
    errorRetryCount: 2,
    provider: () => new Map(),         // ← explicit cache that persists across navs
  };

Verify: navigate /clients → /clients/[id] → back. The clients list must stay 
visible during the back-navigation refetch (no blank flash).
```

### PROMPT Z.2 — Adopt `<PrefetchLink>` everywhere

```
You have a /components/<PrefetchLink>.tsx (search for it). It has zero 
callers. Make it the default link.

STEP 1: Find the file and confirm its API. Typical signature:
  <PrefetchLink href="..." className="..." onMouseEnter={() => router.prefetch(href)}>...</PrefetchLink>

STEP 2: Find the sidebar / top nav component (likely 
/components/Sidebar.tsx or /components/ui/Header.tsx). Replace every 
<Link> there with <PrefetchLink>.

STEP 3: In every list row that links to a detail page (ClientsTable, 
EmployeesTable, EstimatesTable, SchedulesTable, TasksTable, etc.), replace 
the row's <Link> with <PrefetchLink>. The hover-prefetch will mask the 
network latency entirely.

STEP 4: For "Edit"/"View Details"/"Open" buttons that use 
router.push(), wrap them in:
  onMouseEnter={() => router.prefetch(targetUrl)}
  onClick={() => router.push(targetUrl)}

VERIFY: hover over a row in /clients, watch the Network tab — the RSC 
payload for /clients/[id] should fetch on hover. Click the row — the page 
should appear instantly.
```

### PROMPT Z.3 — Two-line next.config.ts upgrade

```
Open /next.config.ts. Find the experimental block. Add these:

  experimental: {
    ...existing,
    staleTimes: {
      dynamic: 30,        // dynamic routes stay fresh for 30s in client cache
      static: 180,        // static routes stay fresh for 3 minutes
    },
    viewTransition: true, // smooth CSS-based page transitions (React 19 / Next 16)
  }

Verify: 
1. Navigate /clients → /dashboard → back to /clients. The browser uses cached 
   RSC payload for the back nav (Network tab shows no /clients RSC fetch within 30s).
2. Page transitions show a CSS fade/slide instead of a blank flash.

If viewTransition causes any visual regression, remove just that line — 
staleTimes alone gives you the bigger win.
```

### PROMPT Z.4 — Fix the FU.6 second-arg hack [3 places]

```
Open these files and remove the invalid second argument 'default' from 
revalidateTag calls:
  - /app/api/roles/route.ts line 244
  - /app/api/employees/[id]/route.ts line 43
  - /app/api/employees/[id]/route.ts line 56

Change:
  revalidateTag(`permissions-${userId}`, 'default')
to:
  revalidateTag(`permissions-${userId}`)

revalidateTag takes ONE argument. Any second arg is silently ignored.
Run `npx tsc --noEmit` (with NODE_OPTIONS="--max-old-space-size=6144") 
afterward and confirm zero errors.
```

### PROMPT Z.5 — Convert SchedulesTable to RSC + fallbackData

```
Open /app/(protected)/jobs/schedules/page.tsx. If it's currently 
'use client', restructure:

NEW page.tsx (RSC, no 'use client'):
  import { Suspense } from 'react';
  import SchedulesTableClient from './SchedulesTable';
  
  async function getInitialSchedules(searchParams: any) {
    // server-side fetch — call the same logic as GET /api/schedules
    // OR import the route handler's data function directly
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/schedules?...`, { cache: 'no-store' });
    return res.json();
  }
  
  export default async function Page({ searchParams }: { searchParams: any }) {
    const initial = await getInitialSchedules(searchParams);
    return (
      <Suspense fallback={<SchedulesSkeleton />}>
        <SchedulesTableClient initialData={initial} />
      </Suspense>
    );
  }

In the client component, accept initialData and pass to useSWR via 
fallbackData:

  const { items, ... } = useInfiniteSchedules(params, {
    fallbackData: [initialData],
  });

Then DELETE the 3 useEffects + 46 fetch calls in SchedulesTable that 
re-fetch on mount. The data is already there from the server.

VERIFY: hard refresh /jobs/schedules with Network throttled to "Fast 3G". 
Schedules render immediately from the streamed RSC, then SWR revalidates 
in the background. No blank state.

Apply the same RSC + fallbackData pattern to:
  - /app/(protected)/employees/page.tsx (eliminates the roles useEffect)
  - /app/(protected)/reports/wip/page.tsx (the biggest 1700ms win)
```

### PROMPT Z.6 — Lazy-load TipTap, Recharts, PapaParse

```
Open these three locations. Replace static imports with next/dynamic:

1. /components/editor/RichTextEditor.tsx (or wherever TipTap is imported):
   Replace: import { useEditor, EditorContent } from '@tiptap/react'
   With a wrapper file /components/editor/RichTextEditor.lazy.tsx that exports:
     import dynamic from 'next/dynamic';
     export const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
       ssr: false,
       loading: () => <div className="h-32 bg-slate-50 animate-pulse rounded" />,
     });
   Update all importers to use the .lazy file.

2. /app/(protected)/reports/wip/page.tsx — wherever <PieChart> / <BarChart> 
   from recharts is rendered. Replace static imports with:
     const WipPieChart = dynamic(() => import('./WipPieChart'), { ssr: false });

3. /app/(protected)/settings/imports/page.tsx — find the `import Papa from 'papaparse'` line.
   Move it inside the import-button click handler:
     async function handleImport() {
       const Papa = (await import('papaparse')).default;
       // ... use Papa here
     }

VERIFY: run `ANALYZE=true npm run build`. The main bundle drops by 
~150-200KB. /estimates/[slug] no longer ships TipTap unless the editor opens.
```

### PROMPT Z.7 — Cleanup: debug log + finish dashboard split

```
TWO small jobs:

1. Open /app/api/schedules/route.ts line 136. Delete the line:
   console.log('FETCHED SCHEDULE:', ...);

2. Continuing FU.10b, extract these from /app/(protected)/dashboard/page.tsx 
   into /app/(protected)/dashboard/_components/:
   - WeekPicker.tsx (the date-range pill at top)
   - ScheduleStrip.tsx (horizontal week strip)
   - SchedulesGrid.tsx (main grid)
   
   Each child fetches its own slice of /api/dashboard via useSWR with the 
   shared key. Wrap each in <Suspense fallback={<SectionSkeleton />}>.

VERIFY: dashboard page.tsx is under 1,000 lines. Each section streams in 
independently. tsc passes.
```

### PROMPT Z.8 — Skeleton audit (do last, polish work)

```
Find every centered <Loader2> spinner in pages and replace with 
layout-matching skeletons.

The pattern: instead of:
  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 /></div>

Use:
  if (isLoading) return <PageSkeleton />

Where <PageSkeleton> renders gray placeholder boxes in the EXACT same 
positions and sizes as the loaded content. This eliminates layout shift 
and makes loading feel like "data filling in" instead of "screen change."

Hot spots: clients/[id], employees/[id], estimates/[slug], 
jobs/schedules/[id]. Each detail page should have a matching 
loading.tsx in the same folder.
```

---

## RECOMMENDED ORDER

If you only have **15 minutes today**: Z.1 + Z.3 + Z.4 + Z.7 part 1.
Those four together solve ~50% of the perceived loading problem.

If you have **2 hours today**: Add Z.2 (PrefetchLink adoption). Now ~75% solved.

If you have **a half-day**: Add Z.5 + Z.6 (RSC conversion + lazy bundle). You're at the "feels instant" target.

Z.7 #2 and Z.8 are polish — no rush.

---

## WHAT WAS GOOD WORK

The agent earned credit for:
- Killing the webhook monolith with zero broken callers (FU.1)
- Stripping all 47 `revalidateTag` cast hacks cleanly (FU.2)
- Fixing schema/index drift on Schedule and Client (FU.4, FU.5)
- TypeScript still compiles 0 errors after a major refactor
- Building `<DataTable>`, `<EntityFormModal>`, `<GenericLineItemsTable>`, the wall-clock date helpers, and the AppContext correctly
- Keeping QuickBooks sync untouched and preserving manual override fields

That's a real refactor. The remaining work is the polish layer that turns "good codebase" into "feels like Linear."
