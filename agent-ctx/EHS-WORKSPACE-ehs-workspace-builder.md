# EHS-WORKSPACE — ehs-workspace builder

**Task ID:** EHS-WORKSPACE
**Agent:** ehs-workspace-builder
**Date:** 2026-10-07
**File created:** `src/components/modules/ehs-workspace.tsx`
**Export:** `EhsWorkspace` (default-named export, client component)

---

## 1. Goal

Build a single client component `EhsWorkspace` for the MEIL ESG / BRSR
Reporting Platform. The component switches content based on
`activeModule` from `useApp()` (AppContext), handling six EHS module
keys, each rendering its own dedicated screen with KPI cards + a table
or chart + an activity feed.

## 2. Spec compliance

| Requirement | Implementation |
|---|---|
| Client component | `'use client'` directive at top |
| TypeScript strict | All props typed, no `any`, no `@ts-ignore` |
| `useApp()` → `activeModule` | `const { activeModule } = useApp()` |
| Module keys handled | `ehs-ops`, `ehs-incidents`, `ehs-inspections`, `ehs-corrective`, `ehs-environmental`, `ehs-training` |
| Amber/orange color theme | `#f59e0b` (amber-500), `#f97316` (orange-500), `#ea580c` (orange-600) — matches existing `EhsDashboard` |
| Fetch `/api/overview` | `fetchOverview` callback, `cache: 'no-store'`, polled every 60s |
| Fetch `/api/activity?take=10` | `fetchActivities` callback, polled every 30s, filtered client-side via `isEhsActivity` |
| Each screen = KPIs + table/chart + activity feed | All 6 screens contain a KPI row, a primary table or chart, and an `ActivityFeedCard` |
| Compact cards, glass classes | `glass glass-shimmer rounded-[20px]`, `glass-subtle`, `EhsKpiTile` constrained to `maxHeight: 100` |
| Framer-motion | `motion.*` for cards, rows, list items; `AnimatePresence` for module switches & feed items |
| No edits to other files | Only `src/components/modules/ehs-workspace.tsx` was created. `module-router.tsx` was NOT touched (router doesn't yet dispatch EHS keys — out of scope per instructions). |

## 3. Architecture

### Data flow
```
EhsWorkspace (root)
  ├── fetchOverview()      GET /api/overview
  ├── fetchActivities()    GET /api/activity?take=10  (EHS-filtered → 6 items)
  └── fetchTasks()         GET /api/action-items      (EHS-filtered → 8 items)
        │
        ▼
  activeModule switch via <AnimatePresence mode="wait">
        │
        ├── ehs-ops           → OpsScreen
        ├── ehs-incidents     → IncidentsScreen
        ├── ehs-inspections   → InspectionsScreen
        ├── ehs-corrective    → CorrectiveScreen
        ├── ehs-environmental → EnvironmentalScreen
        └── ehs-training      → TrainingScreen
```

### Shared sub-components
- `ModuleHeader` — title + subtitle + icon tile + live pill + completion bar
- `EhsKpiTile` — compact ≤100px tile with icon, label, value, optional trend pill, optional alert dot
- `SectionCard` — generic glass card with header + icon + optional action/badge
- `ActivityFeedCard` — vertical timeline activity feed (passed pre-filtered activities)
- `WorkspaceSkeleton` — pulse-skeleton for initial load
- `ErrorState` / `EmptyState` — full-card fallbacks

### Helpers
- `timeAgo`, `initials`, `formatNumber`, `statusClass`
- `isEhsActivity` / `isEhsTask` — client-side filters
- `buildIncidentTrend` — distributes KPI totals across real periods (or synthesized 6-month window) with `[0.05,0.08,0.12,0.15,0.20,0.40]` weights
- `deriveIncidentRoster` — deterministic 6–12 row incident registry
- `deriveInspections` — 8-row inspection register with score / findings / critical
- `deriveCorrectiveActions` — extends real `/api/action-items` tasks with synthetic EHS-specific rows
- `deriveEnvironmentalRecords` — period-wise water/waste/recycled/hazardous
- `deriveTrainingPrograms` — 8 standard EHS training modules with completion %

## 4. Per-screen inventory

| Screen | KPI tiles | Primary content | Chart type | Activity feed |
|---|---|---|---|---|
| **ehs-ops** | Total Incidents, LTIFR, Open Actions, Inspection Coverage | Incident Trend chart + Open Corrective Actions snapshot | stacked AreaChart | ✅ "Recent EHS Activities" |
| **ehs-incidents** | Total Incidents, LTI, Recordable, Fatalities | Incident Registry table + Incident Type Breakdown | donut PieChart | ✅ "Incident Activity Feed" |
| **ehs-inspections** | Inspections Done, Open Findings, Critical Findings, Compliance Score | Inspection Register table + Score by Site | vertical BarChart | ✅ "Inspection Activity Feed" |
| **ehs-corrective** | Open Actions, Critical Severity, In Progress, Overdue | Corrective Action Log table + Severity Distribution | donut PieChart | ✅ "Corrective Action Activity" |
| **ehs-environmental** | Water Withdrawal, Water Recycled %, Waste Generated, Waste Recovered % | Environmental Records table + Water & Waste Trend | grouped BarChart | ✅ "Environmental Activity Feed" |
| **ehs-training** | Training Hours, Coverage, Active Modules, Certifications | Training Programs table + Monthly Training Hours Trend | AreaChart with line gradient | ✅ "Training Activity Feed" |

## 5. Theme constants

```ts
AMBER_PRIMARY   = '#f59e0b'  // amber-500
AMBER_SECONDARY = '#f97316'  // orange-500
AMBER_DEEP      = '#ea580c'  // orange-600
AMBER_SOFT      = '#fcd34d'  // amber-300
AMBER_TINT      = '#fef3c7'  // amber-100
AMBER_MIST      = '#fed7aa'  // orange-200
DONUT_PALETTE   = ['#f59e0b', '#f97316', '#ea580c', '#dc2626']
TOOLTIP_STYLE   = white-glass with amber-tinted border + orange glow shadow
```

## 6. Quality gates

| Check | Command | Result |
|---|---|---|
| ESLint | `bun run lint` | ✅ clean (no warnings, no errors) |
| TypeScript | `bunx tsc --noEmit \| grep ehs-workspace` | ✅ no output (no errors in file) |
| Full tsc | `bunx tsc --noEmit` | Pre-existing errors in `procurement-workspace.tsx`, `role-nav.ts`, `examples/`, `skills/` — all unrelated to this task, untouched per instructions |
| Dev server | Next.js dev server on :3000 reports "ready" | ✅ |

## 7. Integration notes (for future agents)

- `module-router.tsx` currently does NOT dispatch the `ehs-*` keys. To wire `EhsWorkspace` into the SPA, a future agent should add:
  ```tsx
  case 'ehs-ops': case 'ehs-incidents': case 'ehs-inspections':
  case 'ehs-corrective': case 'ehs-environmental': case 'ehs-training':
    return <EhsWorkspace />
  ```
  (Not done here per "Do NOT touch other files" instruction.)
- The component is read-only and derives synthetic rosters/registers deterministically from KPI totals (same pattern as `hr-workspace.tsx`). When real EHS-specific API endpoints (e.g. `/api/incidents`, `/api/inspections`) are added, the `derive*` helpers can be replaced with the API responses directly.
- All fetchers use `cache: 'no-store'` and silent-error polling — a transient API failure keeps the previously-fetched data rather than blanking the screen.
