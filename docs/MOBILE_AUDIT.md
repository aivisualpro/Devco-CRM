# Mobile Responsiveness Audit
**Viewport Tested:** 360px (Mobile-first)
**Scope:** Core (Protected) Routes

---

## 1. Dashboard (`/dashboard`)
**Grade: 3 / 5**
- **Notes:** Top statistical cards respond well (`grid-cols-1 md:grid-cols-2`). However, the Kanban board uses a fixed minimum width (`min-w-[200px]`) on a flex row container, which forces horizontal overflow or squished columns. Modals contain hardcoded `grid-cols-2` inputs.
- **Fixes Needed:**
  - Wrap the Todo Kanban board in a mobile-friendly horizontal scroller (`overflow-x-auto`) or stack columns vertically (`flex-col lg:flex-row`).
  - Update `TaskFormModal` fields to use `grid-cols-1 sm:grid-cols-2` to prevent input squishing.
  - Re-evaluate drag-and-drop interactions for touch-device accessibility.

## 2. Clients (`/clients`)
**Grade: 3 / 5**
- **Notes:** Has a dedicated mobile card view, but sets it to `grid-cols-2`. On a 360px viewport, 170px wide cards result in extremely cramped text, overlapping action icons, and text truncation.
- **Fixes Needed:**
  - Change mobile card view to `grid-cols-1 sm:grid-cols-2` to allow full width for text and data.
  - Allow action icons in the card footer to wrap or use flex spacing more gracefully.

## 3. Employees (`/employees`)
**Grade: 3 / 5**
- **Notes:** Follows the same pattern as Clients. Uses a `grid-cols-2` mobile view which is too narrow. A `w-16 h-16` avatar inside a ~160px card consumes too much real estate, exacerbating the cramped layout. Action icons (Phone, Mail) and badges collide.
- **Fixes Needed:**
  - Update mobile cards to `grid-cols-1 sm:grid-cols-2`.
  - Alternatively, reduce avatar size on mobile screens (`w-12 h-12`).
  - Ensure card footer flex layouts can `flex-wrap` safely.

## 4. Schedules (`/jobs/schedules`)
**Grade: 2 / 5**
- **Notes:** Highly dense UI. Filtering bar, date pickers, and day-of-week tabs do not wrap or scroll natively, causing horizontal layout breaks. Complex data entry modals (JHA, Timesheet, DJT) suffer from fixed-width rows. 
- **Fixes Needed:**
  - Introduce `overflow-x-auto scrollbar-hide` on all horizontal tab lists (Days, Weeks).
  - Ensure complex filter dropdown menus are bounded by `max-w-[calc(100vw-2rem)]`.
  - Refactor data entry modals to use `grid-cols-1 sm:grid-cols-2` responsive stacking.

## 5. Estimates (`/estimates`)
**Grade: 2 / 5**
- **Notes:** Has a functional mobile card stack (`space-y-3`). However, the filter tabs (`TabsList`) are wrapped in a `hidden lg:block` container, entirely removing the ability for mobile users to filter (e.g., Pending vs. Won). Bottom row of the mobile cards can overflow if there are multiple service tags and writers.
- **Fixes Needed:**
  - Expose a mobile fallback for the `TabsList` filters (e.g., a native `<select>` or horizontally scrollable tabs).
  - Apply `flex-wrap` to the service tags and avatar group on the mobile cards to prevent horizontal overflow.

## 6. Reports (WIP) (`/reports/wip`)
**Grade: 3 / 5**
- **Notes:** Page structure stacks nicely. Financial tables utilize `overflow-x-auto`. While this prevents the entire page from breaking, parsing a 15-column financial spreadsheet horizontally on a 360px screen is a heavily degraded user experience.
- **Fixes Needed:**
  - Convert standard table rows into stacked "Summary Cards" exclusively for the mobile view (displaying only Project, Est Amount, Revenue to Date, and Margin).
  - Ensure the header's export/filter actions wrap cleanly into rows or a collapsible menu on smaller breakpoints.
