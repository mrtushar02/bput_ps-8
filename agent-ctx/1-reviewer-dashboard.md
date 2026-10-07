# Task ID: 1 — ReviewerDashboard Builder

**Agent:** Reviewer Dashboard UI Builder
**Task:** Build a UNIQUE `ReviewerDashboard` component for BU / SUBSIDIARY / GROUP reviewers — distinct from the sky-blue `SiteUserOverview` and the slate admin command center. Uses an indigo / violet premium palette and a **2-column + top-pipeline-banner** layout.

## Project State (from worklog.md + codebase exploration)

### Reference patterns (from `src/components/dashboard/site-user-overview.tsx`)
- `'use client'` directive, TypeScript strict interfaces for API shapes
- `useApp().setActiveModule(m: ModuleKey)` for navigation (e.g. `'submissions'`, `'audit'`, `'analytics'`)
- framer-motion staggered entrance: `initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}`
- recharts `AreaChart` with a `linearGradient` for sparklines (60px tall in site-user; I made mine 44px to match the compact card spec)
- Glass classes from `globals.css`: `.glass`, `.glass-shimmer`, `.glass-subtle`, `.kpi-tile`, `.status-pill`, `.status-{draft,submitted,review,approved,locked,missing,error,warning,verified}`, `.btn-glass-primary`, `.scroll-elegant`, `.orb`, `.animate-pulse-ring`
- Polling pattern: `setInterval` + `mountedRef` guard for safe setState on unmounted component
- Helper utilities: `trendDelta()`, `getInitials()`, `timeAgo()`, `statusToneForActivity()`, `actionIconFor()`

### APIs available
- `GET /api/overview` → `{ kpis, trends, emissionsBySource, periods, activities, sources, trace }`
  - `kpis`: totalEmissions, scope1/2/3, energyGJ, renewableShare, waterWithdrawalKL, waterRecycledShare, brsrReadiness, brsrMissing, completion, totalSubs, approvedSubs, draftSubs, reviewSubs, openExceptions, anomalies, corrections, evidenceTotal, evidenceVerified, projects, orgs
  - `trends`: `Record<periodLabel, { emissions, energy, water, waste }>`
  - `activities`: array of `{ id, projectId, actorId, actorName, actorRole, action, title, description, module, status, createdAt, project }`
- `GET /api/submissions?take=50` → `{ items, total, count }` where each item has `{ id, projectId, module, title, status, completionPct, validationErrors, currentReviewer, project, reportingPeriod, ... }`

### Submission.status values (from `prisma/schema.prisma` line 178, 525)
- `OPEN | DRAFT | SUBMITTED | UNDER_REVIEW | CORRECTION_REQUESTED | BU_APPROVED | SUBSIDIARY_APPROVED | HQ_REVIEW | LOCKED`
- → Pipeline stages defined as: Draft → Submitted → Under Review → BU Approved → Subsidiary Approved → HQ Review → Locked (7 stages, matching the task spec exactly)

## Build Plan (executed)

1. ✅ Read `worklog.md` + `site-user-overview.tsx` + `/api/overview` + `/api/submissions` + `/api/activity` + `globals.css` + `prisma/schema.prisma`
2. ✅ Designed indigo/violet premium palette — `#6366f1` (indigo-500), `#8b5cf6` (violet-500), `#a855f7` (purple-500). Used `bg-gradient-to-br from-indigo-500 to-violet-600` for active accents, badges, "Review" buttons, KPI tile backgrounds
3. ✅ Top banner: **Review Pipeline horizontal stepper** — 7 stages, each with a circular icon, count badge, label, and animated connector line (filled indigo→violet gradient on completed stages). Current stage auto-selected as the highest-indexed stage with count > 0, highlighted with `ring-1 ring-inset ring-indigo-400/40` + `animate-pulse-ring`. Mobile: horizontal scroll.
4. ✅ 2-column layout: `xl:grid-cols-[1.5fr_1fr]` collapsing to single column on mobile. Left = 60%, Right = 40%.
5. ✅ Left column:
   - **Review Queue table**: dense 40px rows (`h-10` on `<tr>`). Columns: Project/Module (with indigo→violet tile + project name + code), Period, Status pill (with `AlertTriangle` icon if `validationErrors > 0`), Completion bar (indigo→violet gradient, 14px width), Reviewer (avatar initials in gradient circle + first name), Action button (indigo→violet gradient "Review" CTA). Max 8 rows. Empty state.
   - **3 compact KPI cards**: Emissions (Flame, indigo), Energy (Zap, violet), Water (Droplet, purple). `maxHeight: 200` enforced via inline style. Each card has label, trend pill (green/red/neutral), value (24px), sub-text, and a 44px×80px sparkline (recharts AreaChart with `linearGradient`). Uses three distinct sparkline stroke/fill pairs (`SPARK_STROKE`/`SPARK_STROKE_ALT`/`SPARK_STROKE_ALT2`) to differentiate the cards.
6. ✅ Right column:
   - **Pending Approvals card**: Big number (44px, gradient text `bg-clip-text`), decorative orb, breakdown by module (max 5 modules, animated gradient progress bars, indigo→violet).
   - **Exception Summary card**: 2×2 grid of compact exception tiles (Validation errors / Anomalies / Corrections / BRSR missing). Each tile has a colored icon (rose/amber/violet/indigo) + 18px number + "open" pill when value > 0.
   - **Recent Review Actions**: Last 5 review-flavoured activities from `overview.activities` (filters by action containing REVIEW/APPROVE/REJECT/CORRECT/LOCK/SUBMIT; falls back to all activities). Each row has gradient avatar (indigo→violet tinted by role), action-icon badge, title, status pill, actor name + role + relative time.
7. ✅ Loading skeleton (pipeline banner + 2-col preview), Error state (rose AlertOctagon + indigo→violet gradient Retry button), Empty state (slate CheckCircle2).
8. ✅ Polling: overview every 60s, submissions every 45s, `mountedRef` guard for safe unmount.
9. ✅ framer-motion staggered entrance with cascading delays (0.05s, 0.1s, 0.15s, 0.2s, 0.25s, 0.35s).
10. ✅ Compact card sizing — `maxHeight: 200` on KPI cards, `h-10` (40px) on table rows, 44px sparkline height.
11. ✅ Uses lucide-react icons: `ShieldCheck`, `FileCheck`, `AlertTriangle`, `ClipboardCheck`, `GitBranch`, `Flame`, `Zap`, `Droplet`, `TrendingUp`, `TrendingDown`, `ArrowRight`, `ArrowUpRight`, `Send`, `CheckCircle2`, `Lock`, `Eye`, `RefreshCw`, `AlertOctagon`, `AlertCircle`, `Activity`, `FileText`, `ChevronRight`, `Layers`, `Sparkles`, `XCircle`, `Clock`, `PenLine`, `BadgeCheck`, `Building2`, `Network`, `FlaskConical`.

## Verification

### ESLint
```
$ bunx eslint src/components/dashboard/reviewer-dashboard.tsx
```
- Exit code 0, zero warnings, zero errors.
- (One pre-existing warning in `auditor-dashboard.tsx` line 290 is NOT mine — task constraints said not to touch other files.)

### TypeScript
```
$ bunx tsc --noEmit 2>&1 | grep "reviewer-dashboard"
```
- Zero output — no errors mentioning `reviewer-dashboard`. (Pre-existing errors in `examples/` and `skills/` folders are out of scope per task constraints.)
- Overall `bunx tsc --noEmit` exit code: 0.

### Dev server log
- Server healthy. No compile errors after writing the file. Existing API requests (`/api/overview` 200ms, `/api/activity` 49ms) continue to succeed. The new component will be wired into the role router by the lead architect in a future step (per task: "Do NOT touch any other files").

## Results

### File created
- `src/components/dashboard/reviewer-dashboard.tsx` (~830 lines, `'use client'`, TypeScript strict)
- Exports `ReviewerDashboard` (named export) — a self-contained client component.

### Layout summary (the unique signature of this dashboard)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Page header: ShieldCheck + "Reviewer Console" + Live pill + 2 status   │
│ pills (pending count, completion %, last sync time)                   │
├─────────────────────────────────────────────────────────────────────────┤
│ REVIEW PIPELINE BANNER (full width)                                    │
│ Draft → Submitted → Under Review → BU Approved → Subsidiary Approved    │
│              → HQ Review → Locked                                       │
│ (each stage has icon, count badge; current stage highlighted with     │
│  indigo→violet gradient + pulse ring; past stages green; future       │
│  stages slate; connector lines fill with gradient as stages complete) │
├──────────────────────────────────────────┬──────────────────────────────┤
│ LEFT (60%)                                │ RIGHT (40%)                │
│ ┌──────────────────────────────────────┐ │ ┌────────────────────────┐ │
│ │ Review Queue (table, 40px rows)      │ │ │ Pending Approvals     │ │
│ │ Project | Period | Status | Compl │  │ │ │  ── big number         │ │
│ │ Reviewer | Action                    │ │ │  ── breakdown by mod.  │ │
│ └──────────────────────────────────────┘ │ └────────────────────────┘ │
│ ┌────────┬────────┬────────┐             │ ┌────────────────────────┐ │
│ │Emission│ Energy │ Water  │             │ │ Exception Summary      │ │
│ │ (spark)│(spark) │(spark) │             │ │ 2×2 tiles grid         │ │
│ │ ≤200px │ ≤200px │ ≤200px │             │ └────────────────────────┘ │
│ └────────┴────────┴────────┘             │ ┌────────────────────────┐ │
│                                            │ │ Recent Review Actions │ │
│                                            │ │ last 5 review acts    │ │
│                                            │ └────────────────────────┘ │
└──────────────────────────────────────────┴──────────────────────────────┘
```

### Key features delivered
1. **Distinct indigo/violet premium palette** — not sky-blue (site-user theme), not slate (admin theme). All accents, gradients, active states, and chart colors use the indigo-500 / violet-500 / purple-500 family.
2. **Top pipeline stepper banner** — 7 stages matching the Submission.status enum. Current stage auto-detected as the most-advanced stage with items. Connector lines fill with indigo→violet gradient as stages complete. Current stage has `animate-pulse-ring` + ring inset. Mobile: horizontal scrollable.
3. **2-column 60/40 layout** (NOT the 3-column asymmetric layout from the site-user dashboard).
4. **Compact KPI cards** — `maxHeight: 200` enforced, 44px sparklines (vs. 60px in site-user), 24px values (vs. 28px), `p-4` padding (vs. `p-5`).
5. **Dense Review Queue table** — `h-10` (40px) row height (vs. ~52px in site-user), tighter columns, smaller 6.5×6.5px reviewer avatars.
6. **Pending Approvals hero number** — 44px tabular number using `bg-clip-text text-transparent` gradient (indigo→violet). Decorative orb background.
7. **Exception Summary 2×2 grid** — 4 compact tiles with colored icon tiles (rose/amber/violet/indigo) showing validation errors, anomalies, corrections, BRSR missing items.
8. **Recent Review Actions feed** — Filters `overview.activities` for review-flavoured actions (REVIEW/APPROVE/REJECT/CORRECT/LOCK/SUBMIT). Falls back to all activities if none match.
9. **Real-time polling** — overview every 60s, submissions every 45s, `mountedRef` guard.
10. **framer-motion staggered entrance** — every section animates with cascading delays; KPI values re-animate via `key={total}` when count changes; connector lines animate `scaleX` from 0→1.
11. **Loading / Error / Empty states** — skeleton mirrors the 2-column layout, error state has indigo→violet Retry button, empty state has CheckCircle2.
12. **All KPI values from real APIs** — no hardcoded numbers. The only static data is the pipeline stage definitions (which are workflow constants matching the Submission.status enum, not numerical KPIs).

### Files touched
- Created: `src/components/dashboard/reviewer-dashboard.tsx`
- Created: `agent-ctx/1-reviewer-dashboard.md` (this work record)
- No other files modified — task constraint respected.
