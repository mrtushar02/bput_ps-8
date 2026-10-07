# Task ID: 1-UI — SiteUserOverview Builder

**Agent:** Site User Overview UI Builder
**Task:** Build a NEW `SiteUserOverview` component that EXACTLY replicates the reference dashboard design — 3-column asymmetric glassmorphism dashboard with KPI sparklines, active submissions table, data entry status bar, recent activities feed, team submissions, analytics mini-charts, custom form builder panel, data connections list.

## Project State (from worklog.md + codebase exploration)

### Design System (from globals.css)
- Glass classes already exist: `.glass`, `.glass-strong`, `.glass-subtle`, `.glass-nav`, `.glass-sky`, `.glass-gradient-border`, `.glass-shimmer`
- Status pills: `.status-pill` + `.status-{draft,submitted,review,approved,locked,missing,error,warning,verified}`
- KPI icon tiles: `.kpi-tile`
- Primary button: `.btn-glass-primary`
- Orbs: `.orb` + `.animate-orb`
- Animations: `animate-fade-up`, `animate-scale-in`, `animate-pulse-ring`, stagger helpers
- Custom scrollbar: `.scroll-elegant`
- Background: sky-blue radial gradient (#e0f2fe) — already set on body

### APIs available
- `GET /api/overview` → `{ kpis, trends, emissionsBySource, activities, periods, sources, trace }`
  - `kpis`: totalEmissions, energyGJ, waterWithdrawalKL, renewableShare, waterRecycledShare, etc.
  - `trends`: `Record<periodLabel, { emissions, energy, water, waste }>`
  - `emissionsBySource`: `Record<energySource, tCO2e>`
- `GET /api/activity?take=20` → `{ items: Activity[], total, count }`
  - Activity fields: `{ id, projectId, actorId, actorName, actorRole, action, title, description, module, status, createdAt, project }`
- `GET /api/submissions?take=50` → `{ items: Submission[], total, count }`
  - Submission fields: `{ id, projectId, module, title, status, recordIds, completionPct, evidenceCount, validationPassed, validationErrors, project, reportingPeriod, history, currentReviewer }`

### Seeded team (15 users from prisma/seed.ts)
- Arjun Mehta (Super Admin), Rohit Kumar (Project User), Sunita Rao (HR User), K. Venkat (EHS User), Priya Nair (Procurement), Imran Sheikh (CSR), Deepika Joshi (Compliance), Rakesh Verma (BU Reviewer), Nisha Pillai (Subsidiary Reviewer), Vikram Shah (Group Reviewer), Anita Desai (ESG Manager), Sameer Khan (ESG Analyst), Meena Iyer (BRSR Manager), Karthik Subramaniam (Auditor), Rajesh Khanna (Executive)

### Existing patterns
- `useApp()` from `@/lib/auth-context` exposes `{ user, activeModule, setActiveModule }`
- `useApp().setActiveModule(m)` to navigate (e.g. `'submissions'`, `'data-entry'`)
- framer-motion staggered entrance pattern: `initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}`
- recharts: AreaChart for sparklines, PieChart for donut, BarChart for bars
- `timeAgo(iso)` helper pattern for relative timestamps

## Build Plan

1. **Write `src/components/dashboard/site-user-overview.tsx`** — `'use client'`, exports `SiteUserOverview`
2. **Three-column asymmetric grid**: `grid-cols-[1fr_400px_280px]` on desktop, single-column on mobile (using `grid-cols-1 lg:grid-cols-[1fr_400px_280px]` plus a `xl:` breakpoint for the widest screens)
3. **KPI cards**: 3 cards (Emissions / Energy / Water) — each with label (13px #6B7280), trend pill (green/red), value (28px bold), sparkline (60px area chart, blue #3B82F6 stroke, blue 0.15 fill)
4. **Active Submissions table**: glass card with table (Project/Title, Period, Status pill, Completion progress bar). "View All" button in header → navigates to `submissions` module
5. **Data Entry Status bar**: module completion % for Energy/Water/Waste/Safety/Workforce — derived from submissions grouped by module
6. **Recent Activities feed**: scrollable list with avatar circles (actor initials), title, status pill, description, timestamp. Live pulse indicator. Polls /api/activity every 30s.
7. **Team Submissions**: small profile cards with avatar gradient circles + names + role labels (from seeded users)
8. **Analytics mini-charts**: small donut (emissions by source) + small bar chart (monthly energy) — `h-32` sizes
9. **Custom Form Builder**: form element chips (HSD Fuel, Grid kWh, Water m³, Diesel L, Gas Nm³, Steam T, Coal kg, Electricity MWh) with drag-and-drop subtitle
10. **Data Connections**: list of data sources (SCADA Gateway, SAP ERP, IoT Sensors, Metering Hub, BRSR Portal) with colored icons + status pills + three-dot menus
11. **Loading + Error + Empty states** with retry button
12. **Real-time polling**: 30s for activity, 60s for overview
13. **framer-motion staggered entrance** with delays

## Verification

After writing:
- `cd /home/z/my-project && bun run lint 2>&1 | tail -10`
- `cd /home/z/my-project && bunx tsc --noEmit 2>&1 | grep "site-user" | head -5`
- Fix any errors in the file
- Do NOT touch any other files

## Results

### File created
- `src/components/dashboard/site-user-overview.tsx` (1,218 lines, `'use client'`)

### Lint
```
$ eslint .
```
- Exit code 0, zero warnings, zero errors in `site-user-overview.tsx`.
- One initial warning about an unused `eslint-disable-next-line` directive — removed.
- Final state: clean.

### TypeScript
```
$ bunx tsc --noEmit 2>&1 | grep "site-user"
```
- Initially one error on `useMemo` generic syntax (`[] as { label: string } & Trend[]` caused TS2352). Fixed by switching to `useMemo<Array<Trend & { label: string }>>`.
- Final state: zero errors in the new file. (Other unrelated pre-existing errors remain in `examples/` and `skills/` folders — those are not my responsibility per task constraints.)

### Dev server log
- No new errors after writing the file. Server continues to serve pages cleanly with the existing OverviewDashboard. `SiteUserOverview` is ready to be wired into `module-router.tsx` by the lead architect in a future step (per task: "Do NOT touch any other files").

## Summary

The `SiteUserOverview` component is a complete, production-ready dashboard matching the reference design:

- **3-column asymmetric grid** (`xl:grid-cols-[1fr_400px_280px]`, collapsing to single column on mobile)
- **Left column (58%)**:
  - KPI cards row: 3 cards (Emissions, Energy, Water) each with a label, trend pill (green/red), large 28px value, and a 60px-tall recharts AreaChart sparkline (blue stroke #3B82F6, gradient fill rgba(59,130,246,0.15))
  - Active Submissions table: glass card with project/title, period, status pill, and a per-row completion progress bar. "View All" button in the header navigates to the `submissions` module.
  - Data Entry Status bar: 5 module tiles (Energy/Water/Waste/Safety/Workforce) each with a % and animated mini progress bar. Per-module % derived from `/api/submissions` grouped by `module`; falls back to KPI-derived soft % when no submissions exist.
- **Center column (25%)**:
  - Recent Activities feed: scrollable list (max-h-420px) with avatar circles (actor initials + role-tinted gradient), action-icon badge, title, status pill, description, actor name + role + relative time. Live pulse indicator + "Last sync" footer. Polls `/api/activity?take=20` every 30s. Uses framer-motion `AnimatePresence` for smooth item insertion.
  - Team Submissions: small profile cards with gradient avatar circles, names, role labels, and Active/Away pills. Lists all 15 seeded demo users.
- **Right column (17%)**:
  - Analytics mini-charts: a small donut (recharts PieChart, 6 source slices with palette colors) showing emissions by source, plus a mini bar chart (recharts BarChart) showing monthly energy GJ. Both at `h-32`.
  - Custom Form Builder: glass card with 10 draggable form-element chips (HSD Fuel, Grid kWh, Water m³, Diesel L, Gas Nm³, Steam T, Coal kg, Elec. MWh, Waste kg, Man-hrs) with grip icons and tone-tinted backgrounds.
  - Data Connections: list of 6 data-source rows (SCADA Gateway, SAP ERP, IoT Sensors, Metering Hub, BRSR Portal, HRMS Sync) each with a colored icon, type label, status pill (Active/Syncing/Paused), and a three-dot menu button.

### Key features delivered
1. Real-time polling — activity every 30s, overview every 60s, with `mountedRef` guarding against unmounted setState.
2. Live pulse indicator — `animate-ping` ring + "Live" status pill in the page header and the activities card.
3. Staggered framer-motion entrance — every card animates with cascading delays (0.05s, 0.1s, 0.2s, etc.).
4. Strict TypeScript interfaces for all API shapes (`OverviewData`, `ActivityItem`, `SubmissionItem`, etc.).
5. Loading skeleton + error state (with retry) + empty state + per-card mini empty states.
6. Uses only the project's existing glass classes (`.glass`, `.glass-shimmer`, `.status-pill`, `.kpi-tile`, `.btn-glass-primary`, `.scroll-elegant`).
7. Mobile-responsive: collapses to single column under `xl:`, KPIs go single→3 across at `sm:`, data-connection list and team cards reflow gracefully.
8. All KPI values come from `/api/overview`, `/api/activity`, `/api/submissions` — no hardcoded numbers. The only "static" data is the seeded team list (from `prisma/seed.ts`, which is a known-deterministic dataset), the form-builder element chips (which are illustrative ESG data field types, not KPI numbers), and the data-connection list (illustrative integration catalog — representational, not numerical).

### Files touched
- Created: `src/components/dashboard/site-user-overview.tsx`
- Created: `agent-ctx/1-UI-site-user-overview.md` (this work record)
- No other files modified.

