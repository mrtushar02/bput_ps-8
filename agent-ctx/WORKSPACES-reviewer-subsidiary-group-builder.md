# WORKSPACES — Reviewer / Subsidiary / Group Workspace Builder

## Task
Build three new client workspace components for the MEIL ESG / BRSR
Reporting Platform at `/home/z/my-project`:

1. `src/components/modules/reviewer-workspace.tsx` — exports `ReviewerWorkspace`
2. `src/components/modules/subsidiary-workspace.tsx` — exports `SubsidiaryWorkspace`
3. `src/components/modules/group-workspace.tsx` — exports `GroupWorkspace`

## Constraints honoured
- `'use client'` directive, TypeScript strict mode.
- Each component reads `activeModule` from `useApp()` (in `@/lib/auth-context`).
- Each fetches `/api/overview`, `/api/activity?take=10`, and `/api/submissions`.
- Glass classes (`glass`, `glass-shimmer`, `glass-subtle`), framer-motion
  entrance animations, compact cards (`maxHeight: 100` for KPI tiles,
  `max-h-96 overflow-y-auto scroll-elegant` for tables/lists).
- Full loading skeleton, error state with retry, and empty state.
- Polling: activity every 30s, overview every 60s, submissions every 45s.
- **Did NOT touch any other files** (module-router, role-nav, etc. untouched).

## Module keys handled (per component)

### ReviewerWorkspace — Indigo/Violet (#6366f1, #8b5cf6, #4f46e5)
- `review-queue` → Review Queue: submissions table with Approve/Reject buttons
  (POSTs to `/api/submissions/[id]/approve` & `/api/submissions/[id]/reject`).
- `review-bu` → My BU: KPIs + BU projects table + status donut + module mix.
- `review-consolidation` → Consolidation: 7-stage rollup bar chart +
  approved-vs-pending area trend.
- `review-exceptions` → Exceptions & SLA: derived exception registry with
  SLA countdown timers + severity donut.

### SubsidiaryWorkspace — Blue/Indigo-Deep (#1d4ed8, #2563eb, #1e40af)
- `sub-bucenter` → BU Review Center: BU table with status + donut.
- `sub-esg` → Subsidiary ESG: KPI cards + ESG score radial gauge +
  E/S/G breakdown + 3-area trend chart.
- `sub-brsr-impact` → BRSR Impact: 9 NGBC principle readiness bar chart +
  per-principle table + status donut.
- `sub-approvals` → Approvals: pending subsidiary-approval queue with
  Approve/Reject actions.

### GroupWorkspace — Navy/Gold (#1e3a8a, #1e40af, #d4a017)
- `grp-consolidation` → Group Consolidation: subsidiary rollup table +
  submissions-per-subsidiary bar chart + status donut.
- `grp-enterprise` → Enterprise ESG: radial ESG gauge + E/S/G breakdown +
  emissions/energy trend area chart.
- `grp-brsr` → BRSR Command: 6-section readiness bar chart + per-section
  table + status donut.
- `grp-assurance` → Assurance: audit engagements table + status donut +
  evidence verification stats.
- `grp-risk` → Risk Management: 4×4 likelihood-impact heat-map matrix +
  risk register table + risks-by-category horizontal bar chart.
- `grp-lock` → Approvals & Lock: final lock queue with Approve/Reject/Lock
  actions (POSTs to `/api/submissions/[id]/approve|reject|lock`).

## Architecture (per file)
- Top: `'use client'` + JSDoc header explaining the workspace.
- Types: strict `Kpis`, `OverviewData`, `ActivityItem` + `ActivityResponse`,
  `SubmissionItem` + `SubmissionResponse`.
- Theme constants: `TOOLTIP_STYLE` + 4-6 color tokens + donut palette.
- Helpers: `timeAgo`, `initials`, `formatNumber`, `statusClass`, and a
  role-specific activity filter (`isReviewerActivity` etc.).
- Per-screen derive helpers — deterministic derivation from real KPIs +
  submissions (no hardcoded values).
- `cardEnter` framer-motion variant (staggered entrance).
- Shared sub-components per file: `ModuleHeader`, `KpiTile`, `SectionCard`,
  `WorkspaceSkeleton`, `ErrorState`, `EmptyState`, `ActivityFeedCard`.
- Per-screen function components (one per activeModule key).
- Main exported component: fetches, polls, dispatches via `AnimatePresence`
  + `motion.div` keyed on `activeModule`.

## Quality gates
- `bun run lint` → exit_code=0 (clean).
- `bunx tsc --noEmit | grep -E "reviewer-workspace|subsidiary-workspace|group-workspace"` → no output (no errors).
- One bug fixed during the run: recharts `labelFormatter` callback returned
  `unknown` (rejected by TS). Fixed by wrapping the fallback in `String(l)`
  in both subsidiary-workspace.tsx and group-workspace.tsx.

## Pattern reference used
- `src/components/modules/ehs-workspace.tsx` (closest pattern for
  multi-screen workspace with framer-motion + glass + charts).
- `src/components/modules/csr-workspace.tsx` (rose theme — activity feed +
  KPI tile shapes).
- `src/components/dashboard/reviewer-dashboard.tsx`,
  `subsidiary-reviewer-dashboard.tsx`, `group-reviewer-dashboard.tsx`
  (palette + pipeline concepts for the same reviewer roles).
- `src/lib/role-nav.ts` (canonical ModuleKey list per role).
- `src/app/api/{overview,activity,submissions}/route.ts` (API shapes).
- `src/lib/auth-context.tsx` (useApp + ModuleKey union).
- `src/app/globals.css` (`.glass*`, `.status-*`, `.scroll-elegant`,
  `.glass-shimmer`, `.btn-glass-primary` classes).
