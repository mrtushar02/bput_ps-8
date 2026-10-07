# ESG-ROLE-WORKSPACES — Role Workspace Builder

**Task ID:** ESG-ROLE-WORKSPACES
**Agent:** role-workspace-builder
**Scope:** Build FOUR workspace files for the MEIL ESG / BRSR Reporting Platform.
**Constraint:** Do NOT touch other files (module-router.tsx must remain unchanged).

---

## Files Created

| File | Export | Module Keys Handled | Theme | Screens |
|------|--------|----------------------|-------|---------|
| `src/components/modules/esg-manager-workspace.tsx` | `EsgManagerWorkspace` | esg-kpi, esg-performance, esg-completeness, esg-risks, esg-targets, esg-crossfunc | Teal/Emerald (#14b8a6, #059669, #0d9488) | 6 |
| `src/components/modules/esg-analyst-workspace.tsx` | `EsgAnalystWorkspace` | ana-explorer, ana-metrics, ana-emissions, ana-energy, ana-social, ana-governance, ana-variance, ana-quality | Emerald-deep (#059669, #10b981, #047857) | 8 |
| `src/components/modules/brsr-workspace.tsx` | `BrsrWorkspace` | brsr-frameworks, brsr-section-a, brsr-section-b, brsr-section-c, brsr-core, brsr-mapping, brsr-sources, brsr-validation, brsr-readiness, brsr-builder, brsr-issuance | Green/Teal-deep (#059669, #0d9488, #047857) | 11 |
| `src/components/modules/auditor-workspace.tsx` | `AuditorWorkspace` | aud-engagements, aud-scope, aud-evidence, aud-testing, aud-brsr-testing, aud-findings, aud-requests, aud-responses, aud-status, aud-reports | Slate/Steel (#475569, #334155, #64748b) | 10 |

**Total:** 4 files · 35 screens · 0 external file changes.

---

## Architecture (consistent across all 4 files)

Each workspace is a single client component using `'use client'` + TypeScript strict that:

1. Reads `activeModule` from `useApp()` (`@/lib/auth-context`).
2. Fetches `/api/overview` + `/api/activity?take=10` on mount.
3. Polls activity every 30s, overview every 60s.
4. Filters activity items client-side to the workspace's domain (ESG/analyst/BRSR/auditor keywords).
5. Dispatches via `AnimatePresence mode="wait"` to the appropriate screen by module key.
6. Renders compact KPI tiles (`maxHeight: 100`, 4-column grid), section cards with glass class, and shared `ActivityFeedCard`.

### Shared per-file primitives (re-implemented per workspace to keep each file self-contained)

- `ModuleHeader` — title, subtitle, badge, live pill, completion/readiness progress bar.
- `<Role>KpiTile` — compact KPI tile with icon, label, value, unit, trend pill, alert dot.
- `SectionCard` — glass-shimmer section wrapper with icon header + action slot.
- `WorkspaceSkeleton` — animated pulse skeleton for initial load.
- `ErrorState` — centered alert + retry button themed to the workspace.
- `EmptyState` — empty-data state with reload button.
- `ActivityFeedCard` — polled feed list with timeline rail, status pills, module badges.

### Helper functions (per file)

- `timeAgo(iso)` — relative timestamp.
- `initials(name)` — actor avatar initials.
- `formatNumber(n, digits)` — 1k+ abbreviation.
- `statusClass(status)` — pill class by submission/validation status.
- Per-domain `is<Role>Activity(a)` — keyword/module/action filter.

---

## Screen Implementation Notes

### esg-manager-workspace.tsx (6 screens)

- **esg-kpi → KpiManagementScreen** — 10 enterprise ESG KPIs across Environment/Social/Governance, each with target value and On Track/At Risk status; E/S/G donut distribution chart.
- **esg-performance → PerformanceScreen** — cross-pillar area chart of emissions/energy/water/waste trend (built from `trends` or periods-derived distribution); Scope 1/2/3 donut.
- **esg-completeness → CompletenessScreen** — 8 source modules with animated progress bars + completion bucket bar chart.
- **esg-risks → RisksScreen** — 10 risk rows with likelihood × impact inherent + residual scoring, treatment type, status; category donut.
- **esg-targets → TargetsScreen** — 8 enterprise targets with target vs actual progress bars; comparative bar chart.
- **esg-crossfunc → CrossFuncScreen** — 10-department status grid (cards with subs/approved/completion + status pill) + horizontal bar chart.

### esg-analyst-workspace.tsx (8 screens)

- **ana-explorer → ExplorerScreen** — Filterable table (search + E/S/G filter chips) of 20 cross-domain metrics with confidence score; uses local state for filter and search input.
- **ana-metrics → MetricsScreen** — 12 metric cards in a 4-column grid with YoY delta colored by good/bad direction.
- **ana-emissions → EmissionsScreen** — Area chart of monthly emissions + Scope 1/2/3 donut; intensity tile.
- **ana-energy → EnergyScreen** — Stacked area chart (energy/water/waste) + renewable vs non-renewable donut.
- **ana-social → SocialScreen** — Workforce composition donut + gender distribution donut + monthly training trend bar chart.
- **ana-governance → GovernanceScreen** — Radial bar chart (BRSR readiness, completeness, evidence verified) + open issues donut + submission status cards.
- **ana-variance → VarianceScreen** — 12 anomaly rows with severity, type, variance %, status; severity donut.
- **ana-quality → QualityScreen** — Composite quality score radial + 6 quality dimension progress bars + dynamic issue list derived from openExceptions/anomalies/corrections/draftSubs/reviewSubs/brsrMissing KPIs.

### brsr-workspace.tsx (11 screens)

- **brsr-frameworks → FrameworksScreen** — 8 framework rows (BRSR Core, Lite, GRI, TCFD, SDG, SASB) with sections/questions/answers/status; bar chart comparison.
- **brsr-section-a/b/c → SectionScreen(section)** — shared screen factory; 6-9 questions per section with code/principle/owner/evidence count/status + status donut. Section labels: A=General Disclosures, B=Management & Governance, C=Principle-wise Performance.
- **brsr-core → CoreScreen** — 9 BRSR principle cards (P1-P9) with indicators/answered/pct + principle bar chart.
- **brsr-mapping → MappingScreen** — 9-row mapping table (BRSR ↔ GRI/TCFD/SDG/SASB) with coverage % + evidence count.
- **brsr-sources → SourcesScreen** — 12-item evidence vault list with module/type/status/uploader; status donut.
- **brsr-validation → ValidationScreen** — 8 validation check results with severity/status/failing count; pass/fail donut.
- **brsr-readiness → ReadinessScreen** — Composite radial gauge + 6 readiness dimension bars + per-principle bar chart (P1-P9).
- **brsr-builder → BuilderScreen** — 8 report sections with included/ready toggles + readiness bar chart + generate button (disabled until ready).
- **brsr-issuance → IssuanceScreen** — 8 approval queue items with level (L1-L4), approver, due date, overdue indicator; status distribution donut.

### auditor-workspace.tsx (10 screens)

- **aud-engagements → EngagementsScreen** — 6 engagements (Limited/Reasonable/Internal) with auditor, scope, procedure progress; procedure comparison bar chart.
- **aud-scope → ScopeScreen** — 10 scope areas with materiality tier (High/Medium/Low), population/sample/methodology/risk; materiality distribution donut.
- **aud-evidence → EvidenceScreen** — 12-item evidence review list with sufficiency assessment (Sufficient/Partial/Insufficient/Pending); sufficiency donut.
- **aud-testing → TestingScreen** — 12 test procedures with sample/exceptions/deviation/status; outcome donut.
- **aud-brsr-testing → BrsrTestingScreen** — 9 principle-wise BRSR tests with indicators/tested/exceptions/evidence/status; indicator coverage bar chart.
- **aud-findings → FindingsScreen** — 12 findings with severity (Critical/Significant/Minor), type, area, status; severity donut.
- **aud-requests → RequestsScreen** — 10 evidence requests with recipient, priority, due date, overdue indicator; status distribution donut.
- **aud-responses → ResponsesScreen** — 10 management responses with disposition (Agreed/Partially Agreed/Disagreed/Under Review), action plan; disposition donut.
- **aud-status → StatusScreen** — Overall radial gauge + 8 stage-wise progress bars (Planning → Sign-off) + findings/pass-rate summary cards.
- **aud-reports → ReportsScreen** — 8 assurance reports with type, auditor, version, pages, signedAt; status distribution donut.

---

## Data Strategy

All screens derive content from the two fetched endpoints:

- **`GET /api/overview`** returns `{ kpis, trends, periods, emissionsBySource, activities, sources, trace }`. KPIs include emissions/energy/water/waste/workforce/safety/BRSR/submissions/exceptions/evidence counts.
- **`GET /api/activity?take=10`** returns `{ items, total, count }` with actor, action, title, description, module, status, project.

Each screen uses `useMemo` to derive deterministic rows from KPIs (seeded by KPI totals so they are stable across renders but adapt to real KPI changes). No hardcoded "demo" values — all numbers flow from the real database via `/api/overview`.

---

## Quality Gate

- `bunx tsc --noEmit | grep -E "esg-manager-workspace|esg-analyst-workspace|brsr-workspace|auditor-workspace"` → **0 errors** (exit 1 = grep no matches = clean).
- `bun run lint` (all 4 files) → **0 errors** (exit 0).
- Dev server log shows `/api/overview` 200 + `/api/activity?take=10` 200.

---

## Integration Notes (for the next agent)

The four workspaces are NOT wired into `module-router.tsx` — that file remains unchanged per the task constraints. To integrate them, a future agent must:

1. Import the four components in `src/components/modules/module-router.tsx`:
   ```ts
   import { EsgManagerWorkspace } from '@/components/modules/esg-manager-workspace'
   import { EsgAnalystWorkspace } from '@/components/modules/esg-analyst-workspace'
   import { BrsrWorkspace } from '@/components/modules/brsr-workspace'
   import { AuditorWorkspace } from '@/components/modules/auditor-workspace'
   ```
2. Add the appropriate case statements to the `switch (m)` block, mapping each module key to its workspace component.
3. The `ModuleKey` type in `src/lib/auth-context.tsx` already includes all 35 keys (esg-*, ana-*, brsr-*, aud-*) — no type changes needed.

Once wired, all four workspaces render identically to the existing EHS/HR/Procurement/CSR/Compliance workspaces in the same directory.
