# Task ID: REBUILD-1 — SiteUserOverview 2-Column Rebuild

**Agent:** Site User Overview Rebuilder
**Task:** Completely rewrite `src/components/dashboard/site-user-overview.tsx` to match the reference image's 2-column layout (replacing the old 3-column asymmetric grid).

## Project State (from worklog.md)
- Project already has 5 dashboard designs (overview, reviewer, executive, auditor, command-palette)
- `SiteUserOverview` was originally built as a 3-column asymmetric grid (`xl:grid-cols-[1fr_400px_280px]`)
- REBUILD-1 instruction: convert to a 2-column layout (`lg:grid-cols-[1fr_minmax(380px,42%)]`) with sections below
- Existing glass classes already in `globals.css`: `.glass`, `.glass-strong`, `.glass-subtle`, `.glass-nav`, `.glass-sky`, `.glass-gradient-border`, `.glass-shimmer`, `.status-pill`, `.status-{draft,submitted,review,approved,locked,missing,error,warning,verified}`, `.kpi-tile`, `.btn-glass-primary`, `.orb`, `.scroll-elegant`
- APIs: `/api/overview` (kpis, trends, emissionsBySource, periods), `/api/activity?take=20`, `/api/submissions?take=10`

## Build Plan (executed)
1. Wrote a clean, single-file `SiteUserOverview` with sub-components for each card:
   - `KpiModule` — compact KPI cell (icon tile, label, value, sub, trend pill)
   - `MiniArea` — small recharts AreaChart sparkline (70px height)
   - `SiteEsgOverviewCard` — 2×3 KPI grid (Emissions, Grid Electricity, HSD Diesel, Recycled Water, GHG Trajectory mini-area, Water Recycling mini-area)
   - `RecentActivitiesCard` — tall vertical timeline with avatar circles, status pills, scrollable `max-h-[420px]`
   - `MiniChartCell` — wrapper for 2×2 analytics grid (title, subtitle, more menu, fixed-height chart area)
   - `AnalyticsCard` — 2×2 chart grid (Scope 1 vs 2 GHG area chart, Monthly Energy bar chart, Water Balance donut, CEA v19 Baseline line + value) + 3-col metrics row (Waste Recycled %, BRSR Readiness, Submissions)
   - `QuickActionsCard` — 5 action buttons (Open Data Entry, Upload Evidence, View Pending Submission, Check Validation, View Reports) + Available chips row
   - `ActiveSubmissionsCard` — full-width table (Project/Title, Period, Module, Status pill, Completion progress bar) with skeleton+empty states
   - `DataEntryStatusCard` — 5 compact progress bars (Energy/Water/Waste/Safety/Workforce)
   - `TeamCard` — horizontal scroll of 15 seeded team member mini-cards

2. Layout: 2-column grid (`lg:grid-cols-[1fr_minmax(380px,42%)]`) with full-width sections below
3. Real-time polling preserved: 30s activity, 60s overview
4. framer-motion staggered entrance via `cardEnter` variant + `custom={i}` (30-50ms per card)
5. Loading skeleton mirrors final card dimensions
6. Error state with Retry button + Empty state (no periods) with Configure button
7. All KPI values pulled from real APIs — no hardcoded numbers (only static data: seeded team list, form-element chips)

## Verification

### Lint
```
$ bunx eslint src/components/dashboard/site-user-overview.tsx
```
- Exit code 0, zero warnings, zero errors
- Removed unused lucide imports (Droplet, TrendingUp, TrendingDown, Eye, CheckCircle2, PieIcon, Boxes, Recycle) after first pass

### TypeScript
```
$ bunx tsc --noEmit 2>&1 | grep "site-user-overview"
```
- Output: empty (zero errors in the new file)

### Dev server log
- `GET /api/overview 200 in 183ms` — overview endpoint serves correctly with seeded data
- `GET /api/activity?take=20 200 in 32ms` — activity endpoint responds
- No new errors after file write

## Results

### File touched
- `src/components/dashboard/site-user-overview.tsx` — fully overwritten, ~1140 lines, `'use client'`
- No other files modified

### Layout summary
- **2-column grid (above)**: LEFT (58%) = Site ESG Overview + Recent Activities; RIGHT (42%) = Analytics + Site Operations
- **Full-width (below)**: Active Submissions table, then 2-col row with Data Entry Status | Team
- All cards use `.glass .glass-shimmer` with `rounded-[20px] p-5`; sub-cards use `.glass-subtle .rounded-2xl .p-3`
- Compact KPI modules: 28×28 icon tiles, 10px labels, 20px bold values, 9px sub-text, mini trend pills
- Mini charts: 70px area sparklines (Emissions + Water); 130px chart cells (GHG area, Energy bar, Water donut, Baseline line)
- Mobile-responsive: collapses to single column under `lg:`; KPI grid goes 2→3 across at `md:`; team list horizontal-scrolls

### Real-time features preserved
- `/api/overview` polled every 60s
- `/api/activity` polled every 30s with framer-motion `AnimatePresence` for smooth item insertion
- `mountedRef` guards against setState on unmounted component
- Live-feed indicator in activities card header

### Static data (not KPIs)
- `SEEDED_TEAM` — 15 demo users from `prisma/seed.ts` (representational team list)
- `FORM_ELEMENTS` — 6 illustrative ESG data-element chips (HSD Fuel, Grid kWh, Water m³, Diesel L, Gas Nm³, Steam T)

## Summary
The `SiteUserOverview` component has been completely rewritten to match the reference image's 2-column layout. The previous 3-column asymmetric grid is gone. The new layout has:
- LEFT (58%): Site ESG Overview card (with 2×3 KPI grid + 2 mini area charts) → Recent Site Activities tall vertical timeline
- RIGHT (42%): Site ESG Analytics card (with 2×2 mini chart grid + 3-col metrics row) → Site Operations quick-action buttons + Available chips
- BELOW (full-width): Active Submissions table → 2-col row with Data Entry Status (compact progress bars) | Team / Site Users (horizontal scroll of mini member cards)

All values are pulled from real APIs, with no hardcoded KPI numbers. framer-motion staggered entrance, real-time polling, loading/error/empty states, and shadcn-style glassmorphism are all preserved. Lint and tsc are clean.
