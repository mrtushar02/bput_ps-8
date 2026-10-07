# WORKSPACES — procurement / csr / compliance workspace builder

**Files created:**
- `src/components/modules/procurement-workspace.tsx` (~ 1,545 lines, exports `ProcurementWorkspace`)
- `src/components/modules/csr-workspace.tsx` (~ 1,663 lines, exports `CsrWorkspace`)
- `src/components/modules/compliance-workspace.tsx` (~ 1,781 lines, exports `ComplianceWorkspace`)

No other files were touched (per instruction).

## What was built

Three self-contained client components that each render one of N screens based
on `activeModule` from `useApp()`. Each mirrors the pattern established by
`HrWorkspace` — shared theme constants, `cardEnter` staggered framer-motion
variants, `ModuleHeader` + `*KpiTile` + `WorkspaceSkeleton` + `ErrorState` +
`EmptyState` + `ActivityFeed` shared sub-components, then one screen function
per module key, then a main component that fetches `/api/overview` +
`/api/activity?take=10`, polls, and dispatches by `activeModule` inside an
`AnimatePresence mode="wait"` cross-fade wrapper.

### 1. ProcurementWorkspace — Violet / Purple (`#8b5cf6` / `#a855f7` / `#7c3aed`)

| Key                | Screen               | Highlights |
|--------------------|----------------------|------------|
| `proc-suppliers`    | Supplier Registry    | 4 violet KPI tiles (Active Suppliers / Approved / Total Spend / Avg ESG Score) + dense 42px-row supplier master table (derived sample, 6–10 rows w/ Tier pill, ESG progress bar, spend, status) + tier-distribution donut (Tier 1/2/3) + activity feed |
| `proc-assessments`  | ESG Assessments     | 4 KPI tiles (Completed / In Progress / Overdue / Avg Score) + RadialBar coverage gauge + risk-distribution donut (Low/Medium/High) + assessment registry table w/ score bars & risk pills + activity feed |
| `proc-sourcing`     | Strategic Sourcing  | 4 KPI tiles (Open RFx / In Contract / Pipeline Value / Avg Vendors) + horizontal funnel BarChart by stage (RFx→Bid→Negotiation→Award→Contract) + pipeline tracker table (stage, value, vendors, days-open pill) + activity feed |
| `proc-transactions` | Purchase Txns       | 4 KPI tiles (Total POs / Total Spend / Closed / Avg PO Value) + monthly spend AreaChart (derived from trends w/ synthetic fallback) + category-spend donut + PO registry table (category, amount, status) + activity feed |
| `proc-valuechain`   | Value Chain         | 4 KPI tiles (Upstream Em. / Downstream Em. / Scope 3 Total / High-Criticality nodes) + value-chain emissions BarChart by node + upstream/downstream split donut + node table (type, emissions, share bar, spend, criticality) + activity feed |

### 2. CsrWorkspace — Rose / Pink (`#f43f5e` / `#ec4899` / `#e11d48`)

| Key                 | Screen              | Highlights |
|---------------------|---------------------|------------|
| `csr-projects`       | CSR Projects        | 4 rose KPI tiles (Total / Active / Beneficiaries / Total Budget) + project registry table (theme pill, beneficiaries, budget, status) + status-breakdown donut (Active/Completed/Planned/On Hold) + activity feed |
| `csr-budgets`        | Budget Allocation   | 4 KPI tiles (Allocated / Utilised / Committed / FY Target) + Allocated-vs-Utilised grouped BarChart by theme + utilisation RadialBar gauge + quarterly utilisation AreaChart + theme budget summary table w/ utilisation % bars + activity feed |
| `csr-beneficiaries`  | Beneficiary Demographics | 4 KPI tiles (Total / Female Reach / Children / Divyang Inclusion) + gender BarChart + beneficiary-segment donut (Children/Women/Youth/Elderly/Divyang) + outreach-by-segment table w/ share bars + activity feed |
| `csr-impact`         | Impact Metrics      | 4 KPI tiles (Total Impact Reach / Targets Achieved / On Track / Avg Attainment) + outcome-tracker metric cards grid (6 cards: School Enrolment, Health Camps, Patients, Trees, Skill Trainees, Water Recharge) each w/ baseline/target/actual progress bar + activity feed |
| `csr-community`      | Community Engagement | 4 KPI tiles (Active Programs / Participants / Sessions Held / Avg Engagement) + engagement BarChart by program + community programs table (type, participants, sessions, engagement bar, status) + activity feed |
| `csr-local`          | Local Area Dev      | 4 KPI tiles (Initiatives / Villages / Investment / Beneficiaries) + investment-by-category BarChart + status-split donut (Completed/Ongoing/Planned) + village initiatives registry table + activity feed |

### 3. ComplianceWorkspace — Emerald / Green (`#10b981` / `#059669` / `#047857`)

| Key               | Screen              | Highlights |
|-------------------|---------------------|------------|
| `comp-policies`    | Policy Library     | 4 emerald KPI tiles (Total / Active / Under Review / Drafts) + policy registry table (domain pill, version, approver, last-review, status) + domain-coverage donut + status mini-grid + activity feed |
| `comp-obligations` | Regulatory Obligations | 4 KPI tiles (Filed / In Progress / Due ≤30d / Overdue) + obligations tracker table (regulation, filing, authority, frequency pill, due date, status) + filing-status donut (Filed/In Progress/Due/Overdue) + frequency BarChart + activity feed |
| `comp-controls`    | Internal Controls  | 4 KPI tiles (Effective / Partial / Failed / Avg Effectiveness) + control registry table (framework pill, owner, effectiveness bar, status) + framework-coverage donut + effectiveness-distribution BarChart by score band + activity feed |
| `comp-cases`       | Legal & Regulatory Cases | 4 KPI tiles (Open / Defended / Resolved / Exposure) + case registry table (type pill color-coded, statute, exposure, status) + case-types donut + activity feed |
| `comp-ethics`      | Ethics & Whistleblower | 4 KPI tiles (Under Investigation / Escalated / High Severity / Resolution Rate) + ethics case registry table (category, source, severity color pill, date, status) + severity-distribution donut + cases-by-category horizontal BarChart + activity feed |
| `comp-calendar`    | Compliance Calendar | 4 KPI tiles (Scheduled / Due ≤14d / Overdue / High Priority) + upcoming-deadlines table (type, date, owner, priority color pill, status) sorted by date + events-by-type BarChart + status mini-grid + activity feed |

## Design conformance (all three workspaces)

- **Glass cards:** `glass glass-shimmer rounded-[20px] p-5` with enhanced shadows
- **Text colors:** `text-slate-900` for headings/values, `text-slate-700` for body/labels (per spec)
- **Compact KPI tiles:** `style={{ maxHeight: 100 }}`, theme-tinted icon tiles (7×7), label + value + trend pill
- **Animation:** framer-motion `cardEnter` staggered entrance (custom index → delay) + `AnimatePresence mode="wait"` module-switch transition
- **Charts:** recharts (BarChart, PieChart/donut, AreaChart, RadialBarChart, grouped & horizontal bars) with theme gradients + consistent `TOOLTIP_STYLE`
- **Tables:** sticky theme-tinted headers (`rgba(…,0.92)` + `backdrop-filter: blur(8px)`), `scroll-elegant` custom scrollbar, `max-h-96 overflow-y-auto`, 38–42px dense rows, hover highlight `bg-{theme}-50/40`
- **Status pills:** reuse existing `.status-approved` / `.status-warning` / `.status-missing` / `.status-submitted` / `.status-draft` classes; color-coded inline pills for tier / risk / severity where needed
- **Each screen:** 3–4 compact KPI cards + a data table or chart + an `ActivityFeed` (per spec)
- **Icons:** lucide-react (theme-appropriate: Truck, ShoppingCart, Network, HeartHandshake, Wallet, Users, Scale, Gavel, ShieldCheck, CalendarClock, Flag (for whistleblower — `Whistleblower` icon does not exist in lucide-react v0.525), etc.)

## Data flow (all three workspaces)

- Initial mount: `Promise.all([fetchOverview, fetchActivities])` then `setLoading(false)`
- Polling: activities every 30s, overview every 60s
- `mountedRef` guard against setState-after-unmount
- All screens consume `Kpis` from `overview.kpis`; trends + periods passed down where relevant
- Module-specific activity filters (`isProcActivity` / `isCsrActivity` / `isComplianceActivity`) reduce the global feed to relevant rows, sliced to 6 for display
- All derived registries (suppliers, projects, obligations, controls, cases, ethics, calendar events, etc.) are **deterministic** — seeded by real KPI totals so rendered numbers always reconcile to the live overview

## Verification

- `bun run lint` → exit 0 (clean, no warnings)
- `bunx tsc --noEmit 2>&1 | grep -E "procurement-workspace|csr-workspace|compliance-workspace"` → **no output** (zero type errors in these three files)
- Full `tsc --noEmit` shows 8 pre-existing errors in `examples/websocket/*`, `skills/*`, `src/lib/role-nav.ts` — none in scope for this task
- All module keys verified handled:
  - Procurement: `proc-suppliers`, `proc-assessments`, `proc-sourcing`, `proc-transactions`, `proc-valuechain` (5/5)
  - CSR: `csr-projects`, `csr-budgets`, `csr-beneficiaries`, `csr-impact`, `csr-community`, `csr-local` (6/6)
  - Compliance: `comp-policies`, `comp-obligations`, `comp-controls`, `comp-cases`, `comp-ethics`, `comp-calendar` (6/6)

## Notes for downstream agents

- The module-router (`src/components/modules/module-router.tsx`) is **NOT wired** to render these three workspaces for the new keys — by instruction we did not touch any other files. To enable rendering, add to `module-router.tsx`:
  ```tsx
  import { ProcurementWorkspace } from '@/components/modules/procurement-workspace'
  import { CsrWorkspace } from '@/components/modules/csr-workspace'
  import { ComplianceWorkspace } from '@/components/modules/compliance-workspace'
  // ...
  case 'proc-suppliers': case 'proc-assessments': case 'proc-sourcing':
  case 'proc-transactions': case 'proc-valuechain':
    return <ProcurementWorkspace />
  case 'csr-projects': case 'csr-budgets': case 'csr-beneficiaries':
  case 'csr-impact': case 'csr-community': case 'csr-local':
    return <CsrWorkspace />
  case 'comp-policies': case 'comp-obligations': case 'comp-controls':
  case 'comp-cases': case 'comp-ethics': case 'comp-calendar':
    return <ComplianceWorkspace />
  ```
- The `overview` / `evidence` / `submissions` keys are already handled by existing modules — not duplicated here.
- `AnimatePresence mode="wait"` smoothly cross-fades between module switches.
- All three workspaces follow the exact skeleton/structure of `HrWorkspace` so downstream styling/behaviour stays consistent.
