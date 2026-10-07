# EXEC-WORKSPACE — ExecutiveWorkspace Builder

**Task ID:** EXEC-WORKSPACE
**Agent:** executive-workspace-builder
**File:** `src/components/modules/executive-workspace.tsx`
**Scope:** ONE file only — no other files touched.

## What was built

A single `'use client'` TypeScript-strict client component `ExecutiveWorkspace`
that switches content based on `activeModule` from `useApp()` (AppContext).

### Module keys handled
- `exec-enterprise` → EnterpriseScreen (ESG score gauge + 4 KPI cards: Emissions / Energy / Water / Workforce + trend area chart + Top-3 AI insights snapshot)
- `exec-brsr` → BrsrScreen (BRSR readiness gauge + Section A/B/C breakdown bars + P1–P9 principle dots + radial)
- `exec-risks` → RisksScreen (4-quadrant risk matrix: Critical / High / Medium / Low + Top-3 AI insights)
- `exec-trends` → TrendsScreen (2×2 area-chart grid: emissions + energy + water + waste + KPI summary)
- `exec-bus` → BusScreen (Business Units list: BU name, projects, completion %, status pill + KPI summary)
- `exec-assurance` → AssuranceScreen (Assurance composite gauge + 4 status cards: evidence verified %, audit trail coverage %, exceptions count, composite + exception composition bar chart)

### Design
- Theme: Amber / Gold (`#f59e0b`, `#d4a017`, `#b45309` deep, `#fbbf24` lite)
- Glass classes (`glass`, `glass-shimmer`, `glass-subtle`) from `globals.css`
- framer-motion staggered entrance (`cardEnter` variants), `AnimatePresence` for module switch
- Compact KPI tiles (`ExecKpiTile`, max-height 118px), `SectionCard` wrapper, `ModuleHeader`
- Premium `EsgGauge` SVG radial with amber→gold gradient stroke + grade badge
- `TrendPillView` for delta/status pills; `InsightRow` for AI insights
- Loading skeleton + `ErrorState` + `EmptyState` for empty/period-less data
- Live refresh bar above each screen (silent + manual refresh)

### Data
- `GET /api/overview` → `kpis` (emissions, energy, water, waste, workforce, BRSR readiness, completion, exceptions, evidence, projects, orgs, totalSubs/approvedSubs/draftSubs/reviewSubs) + `trends` + `periods`
- `GET /api/insights` → AI-generated insights (`title`, `severity`, `category`, `insight`, `action`)
- Parallel fetch on mount via `Promise.all`; cancel-safe via `cancelled` flag
- Deterministic derivations from KPIs for: risk register, business units, BRSR principle readiness, section A/B/C completion

### Types (strict)
- `Kpis`, `TrendPoint`, `OverviewData`, `Insight`, `InsightsResponse` — all explicitly typed; no `any` in this file (eslint config has `no-explicit-any` off, but we kept strict anyway).

## QA — verification commands

### ESLint
```bash
$ bun run lint
$ eslint .
# (no output — clean)
```
Exit: 0 — no errors.

### TypeScript
```bash
$ bunx tsc --noEmit | grep executive-workspace
# (no output)
$ echo $?
1   # grep exit 1 = no matches = no TS errors for executive-workspace.tsx
```
Full `bunx tsc --noEmit` shows errors only in `examples/` and `skills/` (pre-existing, ignored directories); the main project + this file compile cleanly.

### Dev server
- `/api/overview` returns 200 OK in ~61ms
- `/api/insights` returns 200 OK
- No `executive-workspace` errors in `dev.log`

## Notes for downstream agents
- The file is **not wired** into `src/components/modules/module-router.tsx` (per instruction: "Do NOT touch other files."). The router still routes `exec-*` keys to the existing `<ExecutiveDashboard />` (the older premium view). To activate the new `ExecutiveWorkspace`, the next agent should add a case to `module-router.tsx`:
  ```tsx
  case 'exec-enterprise':
  case 'exec-brsr':
  case 'exec-risks':
  case 'exec-trends':
  case 'exec-bus':
  case 'exec-assurance':
    return <ExecutiveWorkspace />
  ```
  and import it. Also wire `ModuleKey` already covers these keys (see `auth-context.tsx` line 35).
- Default fallback (unknown `activeModule`) renders `EnterpriseScreen`.
- All screens share the same fetch — switching modules does NOT re-fetch; the live refresh bar calls `load()` which re-fetches both endpoints in parallel.
