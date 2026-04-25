# Search Migration Report (Phase 10)

This report audits the CRM's list-based pages to determine their compliance with the Phase 4 SWR-driven, server-side paginated search infrastructure (`q` parameter).

## Executive Summary
- **Fully Compliant (SWR + Backend):** Clients, Employees
- **Partially Compliant (Backend Filtering, No SWR):** Estimates, Schedules
- **Non-Compliant (Client-side Filtering):** Catalogue, Constants, Contacts
- **N/A:** Tasks (No UI list), Trainings (No search input)

---

## Detailed Audit

### 1. Clients (`/clients/ClientsTable.tsx`)
- **Status:** ✅ **Compliant**
- **SWR Hook:** `useInfiniteClients({ q: debouncedSearch, ... })`
- **Filtering Mechanism:** Server-side search (`debouncedSearch` maps directly to API `q` param).

### 2. Employees (`/employees/EmployeesTable.tsx`)
- **Status:** ✅ **Compliant**
- **SWR Hook:** `useInfiniteEmployees({ q: debouncedSearch, ... })`
- **Filtering Mechanism:** Server-side search (`debouncedSearch` maps directly to API `q` param).

### 3. Estimates (`/estimates/EstimatesTable.tsx`)
- **Status:** ⚠️ **Partial** (Backend Filtering, but Legacy Data Layer)
- **SWR Hook:** Not implemented (Uses explicit `fetch('/api/webhook/devcoBackend')` rather than the `useInfiniteEstimates` hook).
- **Filtering Mechanism:** Search text is passed as `search` inside the POST payload to the server-side backend. No client-side filtering occurs.

### 4. Schedules (`/jobs/schedules/SchedulesTable.tsx`)
- **Status:** ⚠️ **Partial** (Backend Filtering, but Legacy Data Layer)
- **SWR Hook:** Not implemented (Uses explicit `fetch('/api/schedules')` directly).
- **Filtering Mechanism:** Search text is appended to the query parameter `q` manually. The API route processes it on the server side correctly, preventing client-side data overload.

### 5. Catalogue (`/catalogue/page.tsx`)
- **Status:** ❌ **Non-Compliant** (Client-side Filtering)
- **SWR Hook:** Not implemented
- **Filtering Mechanism:** Fetches entire category list via `fetch('/api/webhook/devcoBackend')` and filters results via `useMemo` in the browser based on `search` input.

### 6. Constants (`/constants/page.tsx`)
- **Status:** ❌ **Non-Compliant** (Client-side Filtering)
- **SWR Hook:** Not implemented
- **Filtering Mechanism:** Fetches all constants and performs a client-side `filter()` inside `useMemo` when `search` changes.

### 7. Contacts (`/contacts/page.tsx`)
- **Status:** ❌ **Non-Compliant** (Client-side Filtering)
- **SWR Hook:** Not implemented
- **Filtering Mechanism:** Fetches all active employees using legacy webhook and applies `Array.prototype.filter()` locally for `firstName`, `lastName`, and `email`.

### 8. Tasks & Trainings
- **Tasks:** N/A (No dedicated CRM frontend list page found in `app/(protected)` for tasks)
- **Trainings:** N/A (`/trainings/page.tsx` lacks a search input entirely and renders a static list of the logged-in user's certifications.)

---

## Next Step Recommendations
1. **Prioritize SWR Migration for Schedules and Estimates:** Since they already rely on backend search queries, migrating their fetches to `useInfiniteSchedules` and `useInfiniteEstimates` will be relatively seamless data-wise but requires refactoring the large `.tsx` table components.
2. **Transition Non-Compliant Pages:** Update the API layer for `Catalogue`, `Constants`, and `Contacts` to accept a `q` parameter and migrate their data tables to the factory-generated SWR infinite hooks.
